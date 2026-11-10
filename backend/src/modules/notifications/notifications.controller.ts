import { ApiParam, ApiTags } from '@nestjs/swagger';
import { DocumentBearerAuth, DocumentEndpoint } from '../../documentation/http';
import { boolean, object, uuid } from '../../documentation/schemas';
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

@ApiTags('Notifications')
@DocumentBearerAuth()
@Controller('api/v1/notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('config')
  @DocumentEndpoint(
    'Get push availability',
    200,
    object({ pushConfigured: boolean }),
  )
  config() {
    return { pushConfigured: this.notifications.configured };
  }

  @Put('subscription')
  @DocumentEndpoint(
    'Register a push subscription',
    200,
    object({ registered: { ...boolean, example: true } }),
    [400],
  )
  async register(@GetUser() user: User, @Body() body: RegisterPushDto) {
    await this.notifications.register(user.id, body);
    return { registered: true };
  }

  @Delete('subscription/:installationId')
  @DocumentEndpoint(
    'Unregister a push subscription',
    200,
    object({ registered: { ...boolean, example: false } }),
    [400],
  )
  @ApiParam({ name: 'installationId', schema: uuid })
  async unregister(
    @GetUser() user: User,
    @Param('installationId', new ParseUUIDPipe({ version: '4' }))
    installationId: string,
  ) {
    await this.notifications.unregister(user.id, installationId);
    return { registered: false };
  }
}
