import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { routesV1 } from 'src/config/app.routes';
import { GetUser } from 'src/libs/decorators';
import { JwtGuard } from 'src/libs/guard';
import { FindUserService } from './find-user.service';

@Controller(routesV1.version)
export class FindUserHttpController {
  constructor(private userService: FindUserService) {}
  @UseGuards(JwtGuard)
  @Get(routesV1.auth.userInfo)
  async findUser(@GetUser() user: User) {
    const result = await this.userService.execute(user.id);

    return result;
  }
}
