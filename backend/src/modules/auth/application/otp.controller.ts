import { ApiBody, ApiTags } from '@nestjs/swagger';
import { DocumentEndpoint } from '../../../documentation/http';
import {
  envelope,
  integer,
  object,
  ref,
  text,
} from '../../../documentation/schemas';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequestOTPUseCase } from './request-otp.usecase';
import { VerifyOTPUseCase } from './verify-otp.usecase';
import { routesV1 } from 'src/config/app.routes';
// import { Throttle, SkipThrottle } from '@nestjs/throttler';

@ApiTags('Auth')
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
  @DocumentEndpoint(
    'Request a one-time code',
    200,
    object({ message: text, userId: integer }),
    [403],
  )
  @ApiBody({ required: true, schema: object({ mobileNumber: text }) })
  async request(@Body('mobileNumber') mobileNumber: string) {
    return await this.requestOtp.execute(mobileNumber);
  }
  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.verifyOtp)
  @DocumentEndpoint(
    'Verify a one-time code',
    200,
    envelope(object({ token: ref('Tokens') }), 200),
    [401, 404],
  )
  @ApiBody({ required: true, schema: object({ userId: integer, code: text }) })
  async verify(@Body() body: { userId: number; code: string }) {
    return this.verifyOtp.execute(body.userId, body.code);
  }
}
