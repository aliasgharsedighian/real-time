import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaUserRepository } from '../../database/user.repository';
import { UpdateUserRequestDto } from './update-profile.request.dto';
import { User } from '@prisma/client';

@Injectable()
export class UpdateProfileService {
  constructor(private userRepo: PrismaUserRepository) {}
  async execute(command: UpdateUserRequestDto, user: User) {
    try {
      const updatedUser = await this.userRepo.updateProfile(command, user.id);

      return {
        status: HttpStatus.OK,
        message: 'profile updated successfully',
        data: updatedUser,
      };
    } catch (error) {}
  }
}
