import { GroupsService } from './groups.service';
import { Logger, Module, Provider } from '@nestjs/common';
import { ChatModule } from '../../gateway/chat/chat.module';
import { CqrsModule } from '@nestjs/cqrs';
import { PollingController } from './polling.controller';
import { GetMessagesService } from './polling.service';
import { PrsimaPollingRepository } from './polling.repository';

const httpControllers = [PollingController];

const commandHandlers: Provider[] = [];

const queryHandlers: Provider[] = [GetMessagesService];

const repositories: Provider[] = [PrsimaPollingRepository];

@Module({
  imports: [CqrsModule, ChatModule],
  controllers: [...httpControllers],
  providers: [
    GroupsService,
    Logger,
    ...repositories,
    ...commandHandlers,
    ...queryHandlers,
  ],
})
export class PollingModule {}
