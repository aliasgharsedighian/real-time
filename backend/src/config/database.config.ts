import { ConfigService } from '@nestjs/config';

// Read after ConfigModule has loaded and validated the environment. Use the
// same connection string as Prisma migrations, including URL-encoded credentials.
export function getPostgresConnectionUri(config: ConfigService): string {
  return config.getOrThrow<string>('POSTGRES_DATABASE_URL');
}
