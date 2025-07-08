import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { routesV1 } from 'src/config/app.routes';
import { GetUser } from 'src/libs/decorators';
import { JwtGuard } from 'src/libs/guard';
import { FindUserService } from './find-user.service';
import { FindUserByEmailRequestDto } from './findUser.request.dto';

@Controller(routesV1.version)
@UseGuards(JwtGuard)
export class FindUserHttpController {
  constructor(private userService: FindUserService) {}

  @Get(routesV1.auth.userInfo)
  async findUser(@GetUser() user: User) {
    const result = await this.userService.execute(user.id);

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post(routesV1.search.searchContact)
  async findUserByEmail(@Body() body: FindUserByEmailRequestDto) {
    const result = await this.userService.serachUserByEmail(body.search);

    return result;
  }
}
