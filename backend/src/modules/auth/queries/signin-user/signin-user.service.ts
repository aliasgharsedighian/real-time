import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';
import { SignInRequestDto } from './signin-user.request.dto';
import * as argon from 'argon2';
import { AuthTokenService } from '../../token.service';

@Injectable()
export class SignInUserService {
  constructor(
    private prisma: PrismaService,
    private tokenService: AuthTokenService,
  ) {}

  async execute(body: SignInRequestDto): Promise<any> {
    // find the user by email
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
      include: {
        profile: true,
      },
    });
    // if user does not exist throw exception
    if (!user) throw new NotFoundException('User not found');
    //compare password
    if (user.password) {
      const pwMatches = await argon.verify(user.password, body.password);
      if (!pwMatches) throw new ForbiddenException('Access denied');
    }
    //if password incorrect throw exception

    //send back the user
    if (user.email) {
      const token = await this.tokenService.signToken(user.id, user.email);
      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      };
    }
  }
}
