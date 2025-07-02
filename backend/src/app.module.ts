import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './libs/db/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PollingModule } from './modules/polling/polling.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { UserModule } from './modules/user/user.module';

const modules = [AuthModule, PollingModule, UserModule];

const prismaModule = [PrismaModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // So it's available everywhere
      envFilePath: '.env',
      validate: validateEnv,
    }),
    //this is for rate limit
    ThrottlerModule.forRoot([{ limit: 15, ttl: 2 * 60 * 1000 }]), //2 minutes
    // Modules
    ...modules,
    ...prismaModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
