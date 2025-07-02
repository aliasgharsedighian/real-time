import { Module, Provider } from '@nestjs/common';
import { FindUserHttpController } from './queries/find-user/find-user.http.controller';
import { FindUserService } from './queries/find-user/find-user.service';
import { PrismaUserRepository } from './database/user.repository';
import { UpdateProfileService } from './commands/update-profile/update-profile.service';
import { UpdateProfileHttpController } from './commands/update-profile/update-profile.http.controller';
import { EditUserService } from './commands/update-user/update-user.service';
import { EditUserByAdminHttpController } from './commands/update-user/update-user.http.controller';

const httpControllers = [
  FindUserHttpController,
  UpdateProfileHttpController,
  EditUserByAdminHttpController,
];
const commandHandlers: Provider[] = [UpdateProfileService, EditUserService];
const queryHandlers: Provider[] = [FindUserService];
const repositories: Provider[] = [PrismaUserRepository];

@Module({
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...repositories],
})
export class UserModule {}
