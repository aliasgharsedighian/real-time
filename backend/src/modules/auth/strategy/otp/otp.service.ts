import { OTP } from '../../domain/entities/otp.entity';

export class OTPService {
  constructor() {}

  async generate(userId: any): Promise<OTP> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    return new OTP(userId, code, expiresAt);
  }

  verify(otp: OTP, inputCode: string): boolean {
    return !otp.isExpired() && otp.matches(inputCode);
  }
}
