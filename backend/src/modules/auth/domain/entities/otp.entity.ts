export class OTP {
  constructor(
    public readonly userId: number,
    public readonly code: string,
    public readonly expiresAt: Date,
  ) {}

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  matches(input: string): boolean {
    return this.code === input;
  }
}
