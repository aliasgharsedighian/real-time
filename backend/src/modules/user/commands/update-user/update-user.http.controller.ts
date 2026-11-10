import { ApiTags } from '@nestjs/swagger';
import {
  DocumentBearerAuth,
  DocumentEndpoint,
} from '../../../../documentation/http';
import { envelope, ref, userNotFound } from '../../../../documentation/schemas';
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { Roles } from 'src/libs/decorators/roles.decorator';
import { JwtGuard } from 'src/libs/guard';
import { RolesGuard } from 'src/libs/guard/role.guard';
import { EditUserService } from './update-user.service';
import { GetUserParamsDto } from '../../dtos/get-user.request.dto';
import { EditUserRequestDto } from './update-user.request.dto';

@ApiTags('Users')
@DocumentBearerAuth()
@Controller(routesV1.version)
export class EditUserByAdminHttpController {
  constructor(private editUser: EditUserService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(routesV1.user.updateUser)
  @DocumentEndpoint(
    'Update a user as an administrator',
    200,
    { oneOf: [envelope(ref('User'), 200, 'status'), userNotFound] },
    [400, 403],
  )
  async edit(
    @Body() body: EditUserRequestDto,
    @Param() params: GetUserParamsDto,
  ) {
    const result = await this.editUser.execute(body, params.id);

    return result;
  }
}
