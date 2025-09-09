import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';

@Injectable()
export class LogoutUserService {
  constructor(private prisma: PrismaService) {}

  async execute(userId: number): Promise<any> {
    // find the user by email
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        profile: true,
      },
    });
    // if user does not exist throw exception
    if (!user) throw new NotFoundException('User not found');

    return {
      statusCode: 200,
      message: 'user logout successfully',
    };
  }
}
