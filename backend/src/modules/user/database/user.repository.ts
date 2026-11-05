import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/libs/db/prisma/prisma.service';
import { UpdateUserRequestDto } from '../commands/update-profile/update-profile.request.dto';
import { EditUserRequestDto } from '../commands/update-user/update-user.request.dto';

@Injectable()
export class PrismaUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // exclude: password
          profile: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              address: true,
              avatarId: true,
              showLastSeen: true,
            },
          },
        },
      });
      return user;
    } catch (error) {
      throw error``;
    }
  }

  async findByEmail(email: string, currentUserId: number) {
    const user = await this.prisma.user.findMany({
      where: {
        AND: [
          {
            id: {
              not: currentUserId,
            },
          },
          {
            OR: [
              {
                email: {
                  contains: email,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            address: true,
              avatarId: true,
          },
        },
      },
    });

    return user;
  }

  async updateProfile(profile: UpdateUserRequestDto, id: number) {
    const updateData: UpdateUserRequestDto = {};
    if (profile.firstname !== undefined)
      updateData.firstname = profile.firstname;
    if (profile.lastname !== undefined) updateData.lastname = profile.lastname;
    if (profile.address !== undefined) updateData.address = profile.address;
    if (profile.showLastSeen !== undefined) updateData.showLastSeen = profile.showLastSeen;

    return this.prisma.profile.upsert({
      where: { userId: id },
      create: { ...updateData, userId: id },
      update: updateData,
    });
  }

  async editUser(user: EditUserRequestDto, userId: number) {
    let updateData: any = [];
    if (user.email !== undefined) updateData.email = user.email;
    if (user.role !== undefined) updateData.role = user.role;
    if (user.firstname !== undefined) updateData.firstname = user.firstname;
    if (user.lastname !== undefined) updateData.lastname = user.lastname;
    if (user.address !== undefined) updateData.address = user.address;
    try {
      const updatedUser = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          email: updateData.email,
          role: updateData.role,
          profile: {
            update: {
              firstname: updateData.firstname,
              lastname: updateData.lastname,
              address: updateData.address,
            },
          },
        },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // exclude: password
          profile: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              address: true,
              avatarId: true,
            },
          },
        },
      });

      return updatedUser;
    } catch (error) {
      throw error;
    }
  }
}
