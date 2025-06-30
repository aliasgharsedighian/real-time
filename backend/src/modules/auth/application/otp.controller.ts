import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequestOTPUseCase } from './request-otp.usecase';
import { VerifyOTPUseCase } from './verify-otp.usecase';
import { routesV1 } from 'src/config/app.routes';
// import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller(routesV1.version)
export class OtpController {
  constructor(
    private readonly requestOtp: RequestOTPUseCase,
    private readonly verifyOtp: VerifyOTPUseCase,
  ) {}

  // @Throttle({ default: { limit: 3, ttl: 5 * 60 * 1000 } })
  // @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.requestOtp)
  async request(@Body('mobileNumber') mobileNumber: string) {
    return await this.requestOtp.execute(mobileNumber);
  }
  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.verifyOtp)
  async verify(@Body() body: { userId: number; code: string }) {
    return this.verifyOtp.execute(body.userId, body.code);
  }
}
