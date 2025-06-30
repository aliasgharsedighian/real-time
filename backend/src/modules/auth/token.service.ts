import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { get } from 'env-var';

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  async signToken(userId: number, email: string) {
    const payload = {
      sub: userId,
      email,
    };
    const secret = process.env.JWT_SECRET;
    const refreshSecret = get('JWT_REFRESH_SECRET').required().asString();

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: '2d',
      secret,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
      secret: refreshSecret,
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
