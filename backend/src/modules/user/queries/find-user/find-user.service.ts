import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaUserRepository } from '../../database/user.repository';

@Injectable()
export class FindUserService {
  constructor(private userRepo: PrismaUserRepository) {}
  async execute(id: number): Promise<any> {
    try {
      const user = await this.userRepo.findById(id);

      return {
        statusCode: HttpStatus.ACCEPTED,
        message: 'user found successfully',
        data: user,
      };
    } catch (error) {
      throw new Error(`Service Error: ${error.message}`);
    }
  }
}
