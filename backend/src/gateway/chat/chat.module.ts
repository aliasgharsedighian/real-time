import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway';
import { CallsService } from './calls.service';
import { PresenceModule } from '../../modules/presence/presence.module';
import { ChatTypingService } from './chat-typing.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, PresenceModule],
  providers: [ChatService, ChatGateway, CallsService, ChatTypingService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
