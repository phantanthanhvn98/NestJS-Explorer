import { Injectable } from '@nestjs/common';
import { AuthenticationClient, IAuthenticationService } from "@misraj-sdk/auth";

const authClient: IAuthenticationService =  AuthenticationClient.create({
    provider: "fusionauth",
    config: {
      adminKey: "JvkKh7-hRG4Dk3jFxSxxL585huGl8tDGNVo2vIXguZeByPVr90yCg_i_",
      applicationId: "8afe5588-1a1b-4a12-874c-33a2f6f938f7",
      tenantId: "2d05831c-f1ef-48dc-b100-1647f70f3bf9",
      url: "https://sso-staging.misraj.sa/",
      verificationSecret: "here-is-a-secret-string",
    },
  });


@Injectable()
export class FusionAuthService {
  async login(email: string, password: string): Promise<any> {
      const user = await authClient.login({ email, password });
      return this.transform(user);
    }
  
    async register(email: string, password: string, id?: string, role?: string, verified?: boolean): Promise<any> {
      const user = await authClient.register({ email, password, id, role, verified });
      return user
    }
  
    async validateJWT(token: string): Promise<any> {
      const user = await authClient.validateJWT(token);
      return this.transform(user) 
    }
  
    async generateVerificationToken(userId: string, email: string): Promise<any> {
      const verificationToken = authClient.generateVerificationToken({
      user: { id: userId, email },
      expiresIn: '1d',
      });
      return verificationToken
    }
  
    async verifyUserToken(verificationToken: string): Promise<any> {
      const user = await authClient.verifyUser(verificationToken);
      return user
    }
  
    async changePassword(email: string, newPassword: string, oldPassword?: string): Promise<any> {
      const changed = await authClient.changePassword({ email, newPassword, oldPassword });
      return changed
    }
  
    async getUserById(userId: string): Promise<any> {
      const user = await authClient.getUserById(userId);
      return this.transform(user)
    }

    // only super admin, admin
    async updateUserRole(id: string, roles: string[]): Promise<any>{
      const user = await authClient.updateUser(id, {
        roles: roles
      })
      return this.transform(user)
    }

    // for anyone
    async updateUserInfo(id: string, email?: string, fullname?: string): Promise<any>{
      return await authClient.updateUser(id, {
        fullname: fullname,
        email: email,
      })
    }
  
    async deleteUser(userId: string): Promise<any> {
      const deleted = await authClient.deleteUser(userId);
      return deleted
    }
  
    async loginWithGoogle(googleTokenId: string): Promise<any> {
      const user = await authClient.loginWithGoogle(googleTokenId);
      return user
    }

    transform(user: any){
      console.log(user.role)
      if (Array.isArray(user?.role)){
        user.roles = user?.role[0]
      }else{
        user.roles = user?.role
      }
      return user
    }
}
