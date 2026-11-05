import { Module } from '@nestjs/common';
import { FirebasePushService } from './firebase-push.service';
import { NotificationPresenceService } from './notification-presence.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    FirebasePushService,
    NotificationPresenceService,
    NotificationsService,
  ],
  exports: [NotificationsService, NotificationPresenceService],
})
export class NotificationsModule {}
