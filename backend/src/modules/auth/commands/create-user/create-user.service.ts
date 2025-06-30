import { ConflictException, Injectable } from '@nestjs/common';
import { SignUpRequestDto } from './create-user.request.dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthTokenService } from '../../token.service';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class CreateUserService {
  constructor(
    private prisma: PrismaService,
    private tokenService: AuthTokenService,
  ) {}

  async execute(body: SignUpRequestDto): Promise<any> {
    try {
      // generate the password hash
      const hash = await argon.hash(body.password);
      // save the new user in the db
      const user = await this.prisma.user.create({
        data: {
          email: body.email,
          password: hash,
          role: body.role,
          profile: {
            create: {
              firstname: '',
              lastname: '',
            },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          profile: true,
        },
      });
      //return the saved user
      if (user.email) {
        const token = await this.tokenService.signToken(user.id, user?.email);
        return {
          statusCode: 201,
          message: 'created user successfully',
          // token,
          data: { token },
        };
      }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`This Email is already taken.`);
        }
      }
      throw new Error(`Service Error: ${error.message}`);
    }
  }
}
