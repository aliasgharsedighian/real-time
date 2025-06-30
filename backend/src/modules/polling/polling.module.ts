import { Logger, Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PollingController } from './polling.controller';
import { GetMessagesService } from './polling.service';

const httpControllers = [PollingController];

const commandHandlers: Provider[] = [];

const queryHandlers: Provider[] = [GetMessagesService];

const repositories: Provider[] = [];

@Module({
  imports: [CqrsModule],
  controllers: [...httpControllers],
  providers: [Logger, ...repositories, ...commandHandlers, ...queryHandlers],
})
export class PollingModule {}
