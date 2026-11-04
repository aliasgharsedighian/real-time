import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  IsISO8601,
} from 'class-validator';

export class SearchMessagesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/[\p{L}\p{N}]{3}/u, {
    message: 'Enter at least three consecutive letters or numbers.',
  })
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  beforeId?: number;
}

export class MessageDaysDto {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;

  @IsString()
  @MaxLength(100)
  timeZone: string;
}

export class MessageWindowDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  aroundId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  beforeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  afterId?: number;
}
