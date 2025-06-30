import { Injectable } from '@nestjs/common';
import { OTP } from '../domain/entities/otp.entity';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class OTPRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(otp: OTP): Promise<void> {
    await this.prisma.oTP.create({
      data: {
        userId: otp.userId,
        code: otp.code,
        expiresAt: otp.expiresAt,
      },
    });
  }

  async getLatest(userId: number): Promise<OTP | null> {
    const record = await this.prisma.oTP.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return record
      ? new OTP(record.userId, record.code, record.expiresAt)
      : null;
  }

  async deleteByUserId(userId: number): Promise<void> {
    await this.prisma.oTP.deleteMany({ where: { userId } });
  }
}
