import { ApiParam, ApiTags } from '@nestjs/swagger';
import {
  DocumentBearerAuth,
  DocumentEndpoint,
} from '../../../../documentation/http';
import {
  array,
  envelope,
  integer,
  ref,
  userNotFound,
} from '../../../../documentation/schemas';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { routesV1 } from 'src/config/app.routes';
import { GetUser } from 'src/libs/decorators';
import { JwtGuard } from 'src/libs/guard';
import { FindUserService } from './find-user.service';
import { FindUserByEmailRequestDto } from './findUser.request.dto';

@ApiTags('Users')
@DocumentBearerAuth()
@Controller(routesV1.version)
@UseGuards(JwtGuard)
export class FindUserHttpController {
  constructor(private userService: FindUserService) {}

  @Get(routesV1.auth.userInfo)
  @DocumentEndpoint(
    'Get the signed-in user',
    200,
    envelope(ref('UserWithPresenceSetting'), 202),
  )
  async findUser(@GetUser() user: User) {
    const result = await this.userService.execute(user.id);

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post(routesV1.search.searchContact)
  @DocumentEndpoint(
    'Search users by email',
    200,
    envelope(array(ref('User')), 200),
    [400],
  )
  async findUserByEmail(
    @Body() body: FindUserByEmailRequestDto,
    @GetUser() user: User,
  ) {
    const result = await this.userService.serachUserByEmail(
      body.search,
      user.id,
    );

    return result;
  }

  @Get(routesV1.user.findUserById)
  @DocumentEndpoint('Get a user by ID', 200, {
    oneOf: [envelope(ref('UserWithPresenceSetting'), 200), userNotFound],
  })
  @ApiParam({ name: 'id', schema: integer })
  async findUserById(@Param() params: { id: number }) {
    const result = await this.userService.findUserById(+params.id);

    return result;
  }
}
