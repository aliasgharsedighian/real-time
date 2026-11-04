import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway';
import { CallsService } from './calls.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [ChatService, ChatGateway, CallsService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
