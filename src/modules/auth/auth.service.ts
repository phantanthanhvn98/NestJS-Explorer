import { promisify } from 'util';
import { OrgUserRoles } from 'plus0-sdk';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { v4 as uuidv4 } from 'uuid';
import Noco from 'src/Plus0';
import { genJwt } from '~/services/users/helpers';
import { UsersService } from '~/services/users/users.service';

export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user) {
      const { password, salt, ...result } = user;

      const hashedPassword = await promisify(bcrypt.hash)(pass, user.salt);
      if (user.password === hashedPassword) {
        return result;
      }
    }
    return null;
  }
}
