import { ApiTags } from '@nestjs/swagger';
import {
  DocumentBearerAuth,
  DocumentEndpoint,
} from '../../../../documentation/http';
import { envelope, ref } from '../../../../documentation/schemas';
import { Body, Controller, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { JwtGuard } from 'src/libs/guard';
import { UpdateProfileService } from './update-profile.service';
import { User } from '@prisma/client';
import { GetUser } from 'src/libs/decorators';
import { UpdateUserRequestDto } from './update-profile.request.dto';

@ApiTags('Users')
@DocumentBearerAuth()
@Controller(routesV1.version)
export class UpdateProfileHttpController {
  constructor(private updateProfile: UpdateProfileService) {}

  @UseGuards(JwtGuard)
  @Put(routesV1.user.updateProfile)
  @DocumentEndpoint(
    'Update the signed-in profile',
    200,
    envelope(ref('Profile'), 200, 'status'),
    [400],
  )
  async update(@Body() body: UpdateUserRequestDto, @GetUser() user: User) {
    const result = await this.updateProfile.execute(body, user);

    return result;
  }
}
