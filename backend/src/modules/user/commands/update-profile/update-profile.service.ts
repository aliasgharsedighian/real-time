import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaUserRepository } from '../../database/user.repository';
import { UpdateUserRequestDto } from './update-profile.request.dto';
import { User } from '@prisma/client';
import { PresenceService } from '../../../presence/presence.service';

@Injectable()
export class UpdateProfileService {
  constructor(
    private userRepo: PrismaUserRepository,
    private presence: PresenceService,
  ) {}
  async execute(command: UpdateUserRequestDto, user: User) {
    const updatedUser = await this.userRepo.updateProfile(command, user.id);
    await this.presence.publish(user.id);

    return {
      status: HttpStatus.OK,
      message: 'profile updated successfully',
      data: updatedUser,
    };
  }
}
