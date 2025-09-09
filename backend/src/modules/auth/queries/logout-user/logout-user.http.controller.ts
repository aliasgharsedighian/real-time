import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { LogoutUserService } from './logout-user.service';
import { JwtGuard } from 'src/libs/guard';
import { GetUser } from 'src/libs/decorators';
import { User } from '@prisma/client';
import { Response } from 'express';

@Controller(routesV1.version)
@UseGuards(JwtGuard)
export class LogoutUserHttpController {
  constructor(private logOutAuth: LogoutUserService) {}

  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.logout)
  async logout(
    @GetUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.logOutAuth.execute(user.id);
    res.clearCookie('refresh_token');
    return result;
  }
}
