import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OTPRepository } from '../database/otp.repository';
import { OTPService } from '../strategy/otp/otp.service';
import { AuthTokenService } from '../token.service';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class VerifyOTPUseCase {
  constructor(
    private readonly otpRepo: OTPRepository,
    private readonly otpService: OTPService,
    private tokenService: AuthTokenService,
    private prisma: PrismaService,
  ) {}

  async execute(userId: number, inputCode: string): Promise<any> {
    const otp = await this.otpRepo.getLatest(userId);

    if (!otp || !this.otpService.verify(otp, inputCode)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.phoneNumber) {
      const token = await this.tokenService.signToken(
        user.id,
        user.phoneNumber,
      );
      await this.otpRepo.deleteByUserId(userId);
      return {
        statusCode: 200,
        message: 'You are successfully login',
        // token,
        data: { token },
      };
    }
    // return this.jwtService.sign({ sub: userId });
  }
}
