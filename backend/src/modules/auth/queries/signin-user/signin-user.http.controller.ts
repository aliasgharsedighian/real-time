import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { SignInRequestDto } from './signin-user.request.dto';
import { SignInUserService } from './signin-user.service';
import { Response } from 'express';

@Controller(routesV1.version)
export class SignInUserHttpController {
  constructor(private signinAuth: SignInUserService) {}

  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.signin)
  async signin(
    @Body() body: SignInRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.signinAuth.execute(body);
    res.cookie('token', response.accessToken, {
      httpOnly: true,
      // secure: true, // set true in production with HTTPS
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    return {
      statusCode: 200,
      message: 'user login successfully',
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      },
    };
  }
}
