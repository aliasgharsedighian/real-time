import { ApiBody, ApiTags } from '@nestjs/swagger';
import { DocumentEndpoint } from '../../documentation/http';
import { object, text } from '../../documentation/schemas';
import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { routesV1 } from 'src/config/app.routes';
import { get } from 'env-var';

@ApiTags('Auth')
@Controller(routesV1.version)
export class AuthRefreshController {
  constructor(private readonly jwtService: JwtService) {}

  @HttpCode(HttpStatus.OK)
  @Post(routesV1.auth.refreshToken)
  @DocumentEndpoint(
    'Refresh an access token',
    200,
    object({ accessToken: text }),
    [401],
  )
  @ApiBody({ required: true, schema: object({ refreshToken: text }) })
  async refresh(@Body() body: { refreshToken: string }) {
    try {
      const secret = process.env.JWT_SECRET;
      const refreshSecret = process.env.JWT_REFRESH_SECRET;

      const payload = await this.jwtService.verifyAsync(body.refreshToken, {
        secret: refreshSecret,
      });

      const newAccessToken = await this.jwtService.signAsync(
        {
          email: payload.email,
          sub: payload.sub,
        },
        {
          secret: secret,
          expiresIn: '2d',
        },
      );

      return { accessToken: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
