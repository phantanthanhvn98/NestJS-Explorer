import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { lastValueFrom, Observable } from 'rxjs';
import { extractRolesObj } from 'plus0-sdk';
import type { Request } from 'express';
import type { ExecutionContext } from '@nestjs/common';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { FusionAuthService } from 'src/services/fusion.auth.service';
import User from 'src/models/User';
import { sanitiseUserObj } from 'src/utils';

@Injectable()
export class GlobalGuard extends AuthGuard(['jwt']) {
  constructor(
    private jwtStrategy: JwtStrategy,
    private fustionAuthService: FusionAuthService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    let result;

    const req = context.switchToHttp().getRequest();

    if (req.headers?.['xc-auth']) {
      try {
        result = await this.extractBoolVal(super.canActivate(context));
      } catch (e) {
        console.log(e);
      }
    }

    if (result && !req.headers['xc-shared-base-id']) {
      if (
        req.path.indexOf('/user/me') === -1 &&
        req.header('xc-preview') &&
        ['owner', 'creator'].some((role) => req.user.roles?.[role])
      ) {
        return (req.user = {
          ...req.user,
          isAuthorized: true,
          roles: extractRolesObj(req.header('xc-preview')),
        });
      }
    }

    if (result) return true;

    if (req.headers['xc-token']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('authtoken'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        return this.authenticate(req, {
          ...req.user,
          isAuthorized: true,
          roles: req.user.roles,
        });
      }
    } else if (req.headers['xc-shared-base-id']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('base-view'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        return this.authenticate(req, {
          ...req.user,
          isAuthorized: true,
          isPublicBase: true,
        });
      }
    }

    // If JWT authentication fails, use the fallback strategy to set a default user
    return await this.authenticate(req);
  }

  private async authenticate(
    req: Request,
    user: any = {
      roles: {
        guest: true,
      },
    },
  ): Promise<any> {
    let u
    try{
      u = await this.fustionAuthService.validateJWT(req.cookies.refresh_token)
    }catch{
      // TODO: add expire, error
    }
    user.id = u.id
    user.roles = u.roles
    const userWithRoles = await User.getWithRoles(u.id, {
      user,
      baseId: req?.ncBaseId,
    });
    if (userWithRoles?.roles !== u.role){
      // handle Exception. Miss Match FusionAuth
      console.log(`Mis match roles for ${u?.id} fusion auth role${u.role} {}`)
      await User.update(user.id, {
        roles: u.role
      })
    }

    u.isAuthorized = true
    u.base_roles = userWithRoles?.base_roles

    req.user =  sanitiseUserObj(u) as any;

    return true;
  }

  async extractBoolVal(
    canActivate: boolean | Promise<boolean> | Observable<boolean>,
  ) {
    if (canActivate instanceof Observable) {
      return lastValueFrom(canActivate);
    } else if (
      typeof canActivate === 'boolean' ||
      canActivate instanceof Promise
    ) {
      return canActivate;
    }
  }
}
