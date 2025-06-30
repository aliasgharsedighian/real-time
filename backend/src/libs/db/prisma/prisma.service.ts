import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { postgresConnectionUri } from 'src/config/database.config';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: postgresConnectionUri,
        },
      },
    });
  }
}
