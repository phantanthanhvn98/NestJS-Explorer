import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Request as NestJsRequest,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OrgUserRoles } from 'plus0-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { OrgUsersService } from '~/services/org-users.service';
import { User } from '~/models';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { UsersService } from 'src/services/users/users.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgUsersController {
  constructor(
    private readonly orgUsersService: OrgUsersService,
    private readonly userService: UsersService
  ) {}

  @Delete('/api/v1/users/:userId')
  @Acl('userDelete', {
    scope: 'profile',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userDelete(@Param('userId') userId: string) {
    await this.orgUsersService.userDelete({
      userId,
    });
    return { msg: 'The user has been deleted successfully' };
  }

  // add/remove new users admin
  // TODO: add api for super admin can add/remove super admin

  // get all users for super admin
  @Get('/api/v1/users')
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userList(@Req() req: Request) {
    return new PagedResponseImpl(
      await this.orgUsersService.userList({
        query: req.query,
      }),
      {
        ...req.query,
        // todo: fix - wrong count
        count: await User.count(req.query),
      },
    );
  }

  // App setting for super admin

  @Get('/api/v1/app-settings')
  @Acl('appSettingsGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async appSettingsGet() {
    const settings = await this.orgUsersService.appSettingsGet();
    return settings;
  }

  @Post('/api/v1/app-settings')
  @HttpCode(200)
  @Acl('appSettingsSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async appSettingsSet(@Body() body) {
    await this.orgUsersService.appSettingsSet({
      settings: body,
    });

    return { msg: 'The app settings have been saved' };
  }

  @Post('/api/v1/super-admin/add')
  @Acl('superAdminAdd', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })  
  async addAdmin(@Body() body, @NestJsRequest() req) {
    return await this.userService.registerNewUserIfAllowed({
      user: {},
      email: body.email,
      password: body.password,
      email_verification_token: null,
      req: req,
      rolesBySuperAdmin: body.roles}
    )
  }

  @Post('/api/v1/super-admin/delete')
  @Acl('superAdminDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })  
  async addDelete(@Body() body) {
    return await this.orgUsersService.userDelete(body.userId)
  }

  @Post('/api/v1/super-admin/role')
  @Acl('superAdminChangeRole', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })  
  async changeAllRoles(@Body() body) {
    const { userId, roles} = body
    this.userService.changeAllRoles({userId, roles})
  }

  @Post('/api/v1/admin/role')
  @Acl('adminChangeRole', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.ADMIN],
    blockApiTokenAccess: true,
  })  
  async changeAllRolesExculdeSuperAdmin(@Body() body) {
    const { userId, roles} = body
    this.userService.changeUserRoles({userId, roles})
  }
}
