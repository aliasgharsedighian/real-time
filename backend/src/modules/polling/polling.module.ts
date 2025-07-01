import { Logger, Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PollingController } from './polling.controller';
import { GetMessagesService } from './polling.service';
import { PrsimaPollingRepository } from './polling.repository';

const httpControllers = [PollingController];

const commandHandlers: Provider[] = [];

const queryHandlers: Provider[] = [GetMessagesService];

const repositories: Provider[] = [PrsimaPollingRepository];

@Module({
  imports: [CqrsModule],
  controllers: [...httpControllers],
  providers: [Logger, ...repositories, ...commandHandlers, ...queryHandlers],
})
export class PollingModule {}
