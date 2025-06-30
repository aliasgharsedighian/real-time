import { Module } from '@nestjs/common';
import { CreateUserHttpController } from './commands/create-user/create-user.http.controller';
import { CreateUserService } from './commands/create-user/create-user.service';
import { SignInUserHttpController } from './queries/signin-user/signin-user.http.controller';
import { SignInUserService } from './queries/signin-user/signin-user.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthTokenService } from './token.service';
import { JwtStrategy } from './strategy';
import { OtpController } from './application/otp.controller';
import { OTPService } from './strategy/otp/otp.service';
import { RequestOTPUseCase } from './application/request-otp.usecase';
import { VerifyOTPUseCase } from './application/verify-otp.usecase';
import { NotifierService } from './application/notifier.service';
import { OTPRepository } from './database/otp.repository';
import { AuthRefreshController } from './refresh-token.http.controller';

const httpControllers = [
  CreateUserHttpController,
  SignInUserHttpController,
  OtpController,
  AuthRefreshController,
];

const OtpProviders = [
  OTPService,
  RequestOTPUseCase,
  VerifyOTPUseCase,
  NotifierService,
  OTPRepository,
];

@Module({
  imports: [JwtModule.register({})],
  controllers: [...httpControllers],
  providers: [
    AuthTokenService,
    CreateUserService,
    SignInUserService,
    JwtStrategy,
    ...OtpProviders,
  ],
  exports: [AuthTokenService],
})
export class AuthModule {}
