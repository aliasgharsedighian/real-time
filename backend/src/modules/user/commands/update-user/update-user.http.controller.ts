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

@Controller(routesV1.version)
export class EditUserByAdminHttpController {
  constructor(private editUser: EditUserService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(routesV1.user.updateUser)
  async edit(
    @Body() body: EditUserRequestDto,
    @Param() params: GetUserParamsDto,
  ) {
    const result = await this.editUser.execute(body, params.id);

    return result;
  }
}
