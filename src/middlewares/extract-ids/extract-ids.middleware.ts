import { Injectable, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractRolesObj, OrgUserRoles, ProjectRoles } from 'plus0-sdk';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';
import {
  Base,
  Column,
  Comment,
  Extension,
  Filter,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Hook,
  Model,
  Sort,
  SyncSource,
  View,
} from '~/models';
import rolePermissions from '~/utils/acl';
import { NcError } from '~/helpers/catchError';

export const rolesLabel = {
  [OrgUserRoles.SUPER_ADMIN]: 'super admin',
  [OrgUserRoles.ADMIN]: 'admin',
  [OrgUserRoles.TEAM_LEADER]: 'leader',
  [OrgUserRoles.USER]: 'user',
  [ProjectRoles.OWNER]: 'project owner',
  [ProjectRoles.EDITOR]: 'project editor',
  [ProjectRoles.VIEWER]: 'project viewer',
  [ProjectRoles.COMMENTER]: 'project commenter',
  [ProjectRoles.NO_ACCESS]: 'project no access',
};

export function getRolesLabels(
  roles: (OrgUserRoles | ProjectRoles | string)[],
) {
  return roles
    .filter(
      (role) =>
        ![OrgUserRoles.TEAM_LEADER, OrgUserRoles.USER].includes(
          role as OrgUserRoles,
        ),
    )
    .map((role) => rolesLabel[role]);
}

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware implements NestMiddleware, CanActivate {
  async use(req, res, next): Promise<any> {
    const { params } = req;

    // extract base id based on request path params
    if (params.baseName) {
      const base = await Base.getByTitleOrId(params.baseName);
      if (base) {
        req.ncBaseId = base.id;
        res.locals.base = base;
      }
    }
    if (params.baseId) {
      req.ncBaseId = params.baseId;
    } else if (params.dashboardId) {
      req.ncBaseId = params.dashboardId;
    } else if (params.tableId || params.modelId) {
      const model = await Model.getByIdOrName({
        id: params.tableId || params.modelId,
      });
      req.ncBaseId = model?.project_id;
    } else if (params.viewId) {
      const view =
        (await View.get(params.viewId)) || (await Model.get(params.viewId));
      req.ncBaseId = view?.project_id;
    } else if (
      params.formViewId ||
      params.gridViewId ||
      params.kanbanViewId ||
      params.galleryViewId ||
      params.calendarViewId
    ) {
      const view = await View.get(
        params.formViewId ||
          params.gridViewId ||
          params.kanbanViewId ||
          params.galleryViewId ||
          params.calendarViewId,
      );
      req.ncBaseId = view?.project_id;
    } else if (params.publicDataUuid) {
      const view = await View.getByUUID(req.params.publicDataUuid);
      req.ncBaseId = view?.project_id;
    } else if (params.hookId) {
      const hook = await Hook.get(params.hookId);
      req.ncBaseId = hook?.project_id;
    } else if (params.gridViewColumnId) {
      const gridViewColumn = await GridViewColumn.get(params.gridViewColumnId);
      req.ncBaseId = gridViewColumn?.project_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(params.formViewColumnId);
      req.ncBaseId = formViewColumn?.project_id;
    } else if (params.galleryViewColumnId) {
      const galleryViewColumn = await GalleryViewColumn.get(
        params.galleryViewColumnId,
      );
      req.ncBaseId = galleryViewColumn?.project_id;
    } else if (params.columnId) {
      const column = await Column.get({ colId: params.columnId });
      req.ncBaseId = column?.project_id;
    } else if (params.filterId) {
      const filter = await Filter.get(params.filterId);
      req.ncBaseId = filter?.project_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(params.filterParentId);
      req.ncBaseId = filter?.project_id;
    } else if (params.sortId) {
      const sort = await Sort.get(params.sortId);
      req.ncBaseId = sort?.project_id;
    } else if (params.syncId) {
      const syncSource = await SyncSource.get(req.params.syncId);
      req.ncBaseId = syncSource.project_id;
    } else if (params.extensionId) {
      const extension = await Extension.get(req.params.extensionId);
      req.ncBaseId = extension.project_id;
    }
    // extract fk_model_id from query params only if it's audit post endpoint
    else if (
      [
        '/api/v1/db/meta/audits/rows/:rowId/update',
        '/api/v2/meta/audits/rows/:rowId/update',
        '/api/v1/db/meta/comments',
        '/api/v2/meta/comments',
      ].some(
        (auditInsertOrUpdatePath) => req.route.path === auditInsertOrUpdatePath,
      ) &&
      req.method === 'POST' &&
      req.body?.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: req.body.fk_model_id,
      });
      req.ncBaseId = model?.project_id;
    }
    // extract fk_model_id from query params only if it's audit get endpoint
    else if (
      [
        '/api/v2/meta/comments/count',
        '/api/v1/db/meta/comments/count',
        '/api/v2/meta/comments',
        '/api/v1/db/meta/comments',
        '/api/v1/db/meta/audits',
        '/api/v2/meta/audits',
      ].some((auditReadPath) => req.route.path === auditReadPath) &&
      req.method === 'GET' &&
      req.query.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: req.query?.fk_model_id,
      });
      req.ncBaseId = model?.project_id;
    } else if (
      [
        '/api/v1/db/meta/comment/:commentId',
        '/api/v2/meta/comment/:commentId',
      ].some((commentPatchPath) => req.route.path === commentPatchPath) &&
      (req.method === 'PATCH' || req.method === 'DELETE') &&
      req.params.commentId
    ) {
      const comment = await Comment.get(params.commentId);
      req.ncBaseId = comment?.project_id;
    }
    // extract base id from query params only if it's userMe endpoint or webhook plugin list
    else if (
      [
        '/auth/user/me',
        '/api/v1/db/auth/user/me',
        '/api/v1/auth/user/me',
        '/api/v1/db/meta/plugins/webhook',
        '/api/v2/meta/plugins/webhook',
      ].some((userMePath) => req.route.path === userMePath) &&
      req.query.project_id
    ) {
      req.ncBaseId = req.query.project_id;
    }

    next();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.use(
      context.switchToHttp().getRequest(),
      context.switchToHttp().getResponse(),
      () => {},
    );
    return true;
  }
}

function getUserRoleForScope(user: any, scope: string) {
  if (scope === 'base') {
    return user?.base_roles;
  } else if (scope === 'org') {
    return user?.roles;
  }
}

@Injectable()
export class AclMiddleware implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const permissionName = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    const allowedRoles = this.reflector.get<(OrgUserRoles | string)[]>(
      'allowedRoles',
      context.getHandler(),
    );
    const blockApiTokenAccess = this.reflector.get<boolean>(
      'blockApiTokenAccess',
      context.getHandler(),
    );

    const scope = this.reflector.get<string>('scope', context.getHandler());
    const req = context.switchToHttp().getRequest();
    if (!req.user?.isAuthorized) {
      NcError.unauthorized('Invalid token');
    }
    const roles = req.user.role
      req.user.roles?.[OrgUserRoles.SUPER_ADMIN] === true
        ? OrgUserRoles.SUPER_ADMIN
        : getUserRoleForScope(req.user, scope);

    if (!roles) {
      NcError.forbidden("You don't have permission to access this resource");
    }

    // assign owner role to super admin for all bases
    if (roles === OrgUserRoles.SUPER_ADMIN) {
      req.user.base_roles = {
        [ProjectRoles.OWNER]: true,
      };
    }

    if (req?.user?.is_api_token && blockApiTokenAccess) {
      NcError.apiTokenNotAllowed();
    }
    let isAllowed = ((roles && rolePermissions[roles]) // has roles and rolse exists
    && !(rolePermissions[roles].exclude && permissionName in rolePermissions[roles].exclude)) // not in exclude
    || (rolePermissions[roles] === "*")
    
    if (!isAllowed) {
      NcError.forbidden(
        `${permissionName} - ${roles} : Not allowed`,
      );
    }

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}

export const Acl =
  (
    permissionName: string,
    {
      scope = 'base',
      allowedRoles,
      blockApiTokenAccess,
    }: {
      scope?: string;
      allowedRoles?: (OrgUserRoles | string)[];
      blockApiTokenAccess?: boolean;
    } = {},
  ) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permission', permissionName)(target, key, descriptor);
    SetMetadata('scope', scope)(target, key, descriptor);
    SetMetadata('allowedRoles', allowedRoles)(target, key, descriptor);
    SetMetadata('blockApiTokenAccess', blockApiTokenAccess)(
      target,
      key,
      descriptor,
    );
    UseInterceptors(AclMiddleware)(target, key, descriptor);
  };
