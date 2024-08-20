import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { AppEvents, OrgUserRoles, validatePassword } from 'plus0-sdk';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import { T } from 'nc-help';
import * as ejs from 'ejs';
import bcrypt from 'bcryptjs';
import type {
  PasswordChangeReqType,
  PasswordForgotReqType,
  PasswordResetReqType,
  SignUpReqType,
  UserType,
} from 'plus0-sdk';
import type { NcRequest } from '~/interface/config';
import { genJwt, setTokenCookie } from '~/services/users/helpers';
import { NC_APP_SETTINGS } from '~/constants';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import Plus0 from 'src/Plus0';
import { Store, User, UserRefreshToken } from '~/models';
import { randomTokenString } from '~/helpers/stringHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { BasesService } from '~/services/bases.service';
import { extractProps } from '~/helpers/extractProps';
import { FusionAuthService } from '../fusion.auth.service';
import { sanitiseUserObj } from 'src/utils';

@Injectable()
export class UsersService {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected basesService: BasesService,
    protected fusionAuth: FusionAuthService
  ) {}

  // allow signup/signin only if email matches against pattern
  validateEmailPattern(email: string) {
    const emailPattern = process.env.NC_AUTH_EMAIL_PATTERN;
    if (emailPattern) {
      const regex = new RegExp(emailPattern);
      if (!regex.test(email)) {
        NcError.forbidden('Not allowed to signup/signin with this email');
      }
    }
  }

  async findOne(_email: string) {
    const email = _email.toLowerCase();
    const user = await this.metaService.metaGet(null, null, MetaTable.USERS, {
      email,
    });

    return user;
  }

  async insert(param: {
    token_version: string;
    firstname: any;
    password: any;
    salt: any;
    email_verification_token: any;
    roles: string;
    email: string;
    lastname: any;
  }) {
    return this.metaService.metaInsert2(null, null, MetaTable.USERS, {
      ...param,
      email: param.email?.toLowerCase(),
    });
  }

  async profileUpdate({
    id,
    params,
  }: {
    id: number;
    params: {
      display_name?: string;
      avatar?: string;
    };
  }) {
    const updateObj = extractProps(params, ['display_name', 'avatar']);

    return await User.update(id, updateObj);
  }

  async registerNewUserIfAllowed({
    user,
    email,
    password,
    email_verification_token,
    req,
    rolesBySuperAdmin
  }: {
    user,
    email: string;
    password;
    email_verification_token;
    req: NcRequest;
    // only input role there when supper admin
    rolesBySuperAdmin?: string;
  }) {

    const salt = await promisify(bcrypt.genSalt)(10);
    const hashPassword = await promisify(bcrypt.hash)(password, salt);

    this.validateEmailPattern(email);

    let roles: string = OrgUserRoles.USER;

    const isFirstUser = await User.isFirst();

    if (isFirstUser && process.env.NC_CLOUD !== 'true') {
      roles = OrgUserRoles.SUPER_ADMIN
    }else{
      roles = OrgUserRoles.USER
    }
    roles = rolesBySuperAdmin ? rolesBySuperAdmin: roles

    const token_version = randomTokenString();
    user = user?.id ? user: (await User.insert({
      email,
      salt,
      password: hashPassword,
      email_verification_token,
      roles,
      token_version,
    }));
    try{
      if (!user?.fsauth_stored){
        let auth_user = await this.fusionAuth.register(
          email, 
          hashPassword, 
          user.id,
          roles, 
          false,
        );
        // only fusionAuth oke: update fsauth_stored true
        if (auth_user?.id)
          await User.update(user.id, {fsauth_stored: true})
      }
    }
    catch (e){
      if (e.code == 400 && ((e?.message as string).includes("registered") || (e?.message as string).includes("exists"))){
        await User.update(user.id, {fsauth_stored: true})
      }
      console.log(`error fusion auth register ${e?.code} ${e?.message}`)
    }
    console.log(user)
    const bases = await this.basesService.baseList({ user: {id: user.id}, query: null});

    (user as any).createdProject = bases?.length ? bases : await this.createDefaultProject(user, req);
    return user as any;
  }

  async passwordChange(param: {
    body: PasswordChangeReqType;
    user: UserType;
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordChangeReq',
      param.body,
    );

    const { currentPassword, newPassword } = param.body;

    if (!currentPassword || !newPassword) {
      return NcError.badRequest('Missing new/old password');
    }

    // validate password and throw error if password is satisfying the conditions
    const { valid, error } = validatePassword(newPassword);

    if (!valid) {
      NcError.badRequest(`Password : ${error}`);
    }

    const user = await User.getByEmail(param.user.email);

    const hashedPassword = await promisify(bcrypt.hash)(
      currentPassword,
      user.salt,
    );
    console.log("hashedPassword", currentPassword, newPassword, user.password, hashedPassword)
    if (hashedPassword !== user.password) {
      return NcError.badRequest('Current password is wrong');
    }

    const password = await promisify(bcrypt.hash)(newPassword, user.salt);
    try{
      this.fusionAuth.changePassword(user.email, password, hashedPassword)
    }catch{
      NcError.internalServerError("Cannot change password")
    }

    await User.update(user.id, {
      password,
      email: user.email,
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_PASSWORD_CHANGE, {
      user: user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return true;
  }

  async passwordForgot(param: {
    body: PasswordForgotReqType;
    siteUrl: string;
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordForgotReq',
      param.body,
    );

    const _email = param.body.email;

    if (!_email) {
      NcError.badRequest('Please enter your email address.');
    }

    const email = _email.toLowerCase();
    const user = await User.getByEmail(email);

    if (user) {
      const token = uuidv4().toString();
      await User.update(user.id, {
        email: user.email,
        reset_password_token: token,
        reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
        token_version: randomTokenString(),
      });
      try {
        const resetPasswordLink = param.siteUrl + `/auth/password/reset/${token}`
        console.log(`reset password link for ${user?.id}: ${resetPasswordLink}`)
        const template = (
          await import('~/modules/auth/ui/emailTemplates/forgotPassword')
        ).default;
        await NcPluginMgrv2.emailAdapter().then((adapter) =>
          adapter.mailSend({
            to: user.email,
            subject: 'Password Reset Link',
            text: `Visit following link to update your password : ${param.siteUrl}/auth/password/reset/${token}.`,
            html: ejs.render(template, {
              resetLink: resetPasswordLink
            }),
          }),
        );
      } catch (e) {
        console.log(e);
        return NcError.badRequest(
          'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
        );
      }

      this.appHooksService.emit(AppEvents.USER_PASSWORD_FORGOT, {
        user: user,
        ip: param.req?.clientIp,
        req: param.req,
      });
    } else {
      return NcError.badRequest('Your email has not been registered.');
    }

    return true;
  }

  async tokenValidate(param: { token: string }): Promise<any> {
    const token = param.token;

    const user = await Plus0.ncMeta.metaGet(null, null, MetaTable.USERS, {
      reset_password_token: token,
    });

    if (!user || !user.email) {
      NcError.badRequest('Invalid reset url');
    }
    if (new Date(user.reset_password_expires) < new Date()) {
      NcError.badRequest('Password reset url expired');
    }

    return true;
  }

  async passwordReset(param: {
    body: PasswordResetReqType;
    token: string;
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordResetReq',
      param.body,
    );

    const { token, body } = param;

    const user = await Plus0.ncMeta.metaGet(null, null, MetaTable.USERS, {
      reset_password_token: token,
    });

    if (!user) {
      NcError.badRequest('Invalid reset url');
    }
    if (user.reset_password_expires < new Date()) {
      NcError.badRequest('Password reset url expired');
    }
    if (user.provider && user.provider !== 'local') {
      NcError.badRequest('Email registered via social account');
    }

    // validate password and throw error if password is satisfying the conditions
    const { valid, error } = validatePassword(body.password);
    if (!valid) {
      NcError.badRequest(`Password : ${error}`);
    }

    const password = await promisify(bcrypt.hash)(body.password, user.salt);

    try{
      this.fusionAuth.changePassword(
        user.email,
        password,
        user.password,
      )
    }catch{
      NcError.internalServerError("Change password server error")
    }

    await User.update(user.id, {
      password,
      email: user.email,
      reset_password_expires: null,
      reset_password_token: '',
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_PASSWORD_RESET, {
      user: user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return true;
  }

  async emailVerificationToken(param: {
    userId: string;
    email: string;
    req: NcRequest;
  }): Promise<any> {
    const { userId, email, req } = param;
    await this.sendVerificationEmail({
        userId: userId,
        email: email
      }
    )
  }

  async emailVerification(param: {
    token: string;
    // todo: exclude
    req: NcRequest;
  }): Promise<any> {
    const { token, req } = param;

    const user = await this.fusionAuth.verifyUserToken(token)

    if (!user) {
      NcError.badRequest('Invalid verification url');
    }

    await User.update(user.id, {
      email: user.email,
      email_verification_token: '',
      email_verified: true,
    });

    this.appHooksService.emit(AppEvents.USER_EMAIL_VERIFICATION, {
      user: user,
      ip: req?.clientIp,
      req,
    });

    return true;
  }

  async refreshToken(param: {
    body: SignUpReqType;
    req: any;
    res: any;
  }): Promise<any> {
    try {
      if (!param.req?.cookies?.refresh_token) {
        NcError.badRequest(`Missing refresh token`);
      }

      const oldRefreshToken = param.req.cookies.refresh_token;

      const user = await User.getByRefreshToken(oldRefreshToken);

      if (!user) {
        NcError.badRequest(`Invalid refresh token`);
      }

      const refreshToken = this.fusionAuth.changePassword

      setTokenCookie(param.res, refreshToken);

      return {
        refreshToken
      } as any;
    } catch (e) {
      NcError.badRequest(e.message);
    }
  }


  async signup(param: {
    body: SignUpReqType;
    req: any;
    res: any;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SignUpReq', param.body);

    const { email: _email, token, ignore_subscribe } = param.req.body;

    let { password } = param.req.body;

    // validate password and throw error if password is satisfying the conditions
    const { valid, error } = validatePassword(password);
    if (!valid) {
      NcError.badRequest(`Password : ${error}`);
    }

    if (!isEmail(_email)) {
      NcError.badRequest(`Invalid email`);
    }

    const email = _email.toLowerCase();

    this.validateEmailPattern(email);

    let user = await User.getByEmail(email);

    if (user?.fsauth_stored) {
      NcError.badRequest('User already exist');
    }

    const { createdProject } = await this.registerNewUserIfAllowed({
        user,
        email,
        password,
        email_verification_token: null,
        req: param.req,
      });

    user = await User.getByEmail(email);
    const f_user = await this.fusionAuth.getUserById(user.id)
    if (!user.id && f_user.id)
      return {msg: "[Server error] cannot create users"}
    try{
      await this.sendVerificationEmail({
          userId: user.id,
          email: user.email
        }
      )
    }catch{
      NcError.internalServerError("Cannot send verification mail")
    }
    this.appHooksService.emit(AppEvents.USER_SIGNUP, {
      user: user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    this.appHooksService.emit(AppEvents.WELCOME, {
      user,
      req: param.req,
    });
    return { user, createdProject };
  }

  async sendVerificationEmail(params: {userId: string, email: string}){
    const {userId, email} = params
    const verifyToken = await this.fusionAuth.generateVerificationToken(userId, email)
    const projectUrl = process.env["PROJECT_URL"]  ? process.env["PROJECT_URL"] :  "http://localhost:8080"
    try {
      const verifyUrl = `${projectUrl}/api/v1/auth/email/validate/${verifyToken}`
      console.log("[info] verify link", userId, verifyUrl)
      const template = (await import('~/modules/auth/ui/emailTemplates/verify'))
        .default;
      await (
        await NcPluginMgrv2.emailAdapter()
      ).mailSend({
        to: email,
        subject: 'Verify email',
        html: ejs.render(template, {
          verifyLink:verifyUrl
        }),
      });
    } catch (e) {
      console.log(e)
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
      );
    }
  }

  async login(user: UserType & { password?: string, provider?: string }, req: any) {
    const user_ = await User.getByEmail(user.email)
    if (!user)
      NcError.badRequest(`User ${user.email} do not exist`)
    this.appHooksService.emit(AppEvents.USER_SIGNIN, {
      user,
      req,
    });
    const password = await promisify(bcrypt.hash)(user.password, user_.salt);
    const token = await this.fusionAuth.login(
      user.email,
      password
    )
    return {user: sanitiseUserObj(user), token};
  }

  async signOut(param: { res: any; req: any }) {
    try {
      this.clearCookie(param);
      return { msg: 'Signed out successfully' };
    } catch (e) {
      NcError.badRequest(e.message);
    }
  }

  protected clearCookie(param: { res: any; req: any }) {
    param.res.clearCookie('refresh_token');
  }

  private async createDefaultProject(user: User, req: any) {
    // create new base for user
    const base = await this.basesService.createDefaultBase({
      user,
      req,
    });

    return base;
  }

  async setRefreshToken({ res, req }) {
    const userId = req.user?.id;

    if (!userId) return;

    const user = await User.get(userId);

    if (!user) return;

    const refreshToken = randomTokenString();

    if (!user['token_version']) {
      user['token_version'] = randomTokenString();
    }

    await User.update(user.id, {
      token_version: user['token_version'],
    });

    await UserRefreshToken.insert({
      token: refreshToken,
      fk_user_id: user.id,
      meta: req.user?.extra,
    });

    setTokenCookie(res, refreshToken);
  }

  async changeAllRoles(params: {
    userId: string,
    roles: string
  }){
    const {userId, roles} = params
    return await this.changeRoles(
      {userId, roles}
    )
  }

  async changeUserRoles(params: {
    userId: string,
    roles: string
  }){
    const {userId, roles} = params
    if (roles === OrgUserRoles.SUPER_ADMIN){
      NcError.badRequest("Admin cannot change Super Admin Role")
    }
    return await this.changeRoles(
      {userId, roles}
    )
  }

  async changeRoles(
    params: {
      userId: string,
      roles: string
    }
  ){
    const {userId, roles} = params;
    try{
      const user = await this.fusionAuth.updateUserRole(userId, [roles])
      console.log(user)
    }catch(e){
      NcError.internalServerError(`Cannot change roles for ${userId} by ${roles} ${e.message}`)
    }
    return await User.update(userId, {
      roles: roles
    })
  }
}
