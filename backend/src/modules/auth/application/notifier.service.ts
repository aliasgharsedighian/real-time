import { Injectable } from '@nestjs/common';

@Injectable()
export class NotifierService {
  async sendOTP(mobileNumber: string, code: string) {
    // Replace with actual email/SMS service like Twilio, SendGrid, etc.
    console.log(`OTP for user ${mobileNumber}: ${code}`);
  }
}
