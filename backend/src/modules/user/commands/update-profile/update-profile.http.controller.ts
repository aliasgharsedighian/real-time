import { Body, Controller, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { JwtGuard } from 'src/libs/guard';
import { UpdateProfileService } from './update-profile.service';
import { User } from '@prisma/client';
import { GetUser } from 'src/libs/decorators';
import { UpdateUserRequestDto } from './update-profile.request.dto';

@Controller(routesV1.version)
export class UpdateProfileHttpController {
  constructor(private updateProfile: UpdateProfileService) {}

  @UseGuards(JwtGuard)
  @Put(routesV1.user.updateProfile)
  async update(@Body() body: UpdateUserRequestDto, @GetUser() user: User) {
    const result = await this.updateProfile.execute(body, user);

    return result;
  }
}
