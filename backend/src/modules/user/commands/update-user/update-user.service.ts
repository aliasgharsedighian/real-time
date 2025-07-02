import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaUserRepository } from '../../database/user.repository';
import { EditUserRequestDto } from './update-user.request.dto';

@Injectable()
export class EditUserService {
  constructor(private userRepo: PrismaUserRepository) {}

  async execute(command: EditUserRequestDto, userId: number) {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'user not found',
        };
      }

      const updatedUser = await this.userRepo.editUser(command, userId);

      return {
        status: HttpStatus.OK,
        message: 'user updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      throw new Error(`Service Error: ${error.message}`);
    }
  }
}
