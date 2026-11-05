import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../../libs/guard';
import { GetUser } from '../../libs/decorators';
import { RegisterPushDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('config')
  config() {
    return { pushConfigured: this.notifications.configured };
  }

  @Put('subscription')
  async register(@GetUser() user: User, @Body() body: RegisterPushDto) {
    await this.notifications.register(user.id, body);
    return { registered: true };
  }

  @Delete('subscription/:installationId')
  async unregister(
    @GetUser() user: User,
    @Param('installationId', new ParseUUIDPipe({ version: '4' }))
    installationId: string,
  ) {
    await this.notifications.unregister(user.id, installationId);
    return { registered: false };
  }
}
