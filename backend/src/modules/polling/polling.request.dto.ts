import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SendMessageRequestDto {
  @IsNotEmpty({ message: 'content is required' })
  @IsString()
  readonly content: string;

  @IsNotEmpty({ message: 'chatId is required' })
  @IsNumber()
  readonly chatId: number;
}

export class CreateChatRequestDto {
  @IsNotEmpty({ message: 'content is required' })
  @IsString()
  readonly firstMessage: string;

  @Transform(({ value }) => {
    try {
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;
    } catch {
      return [];
    }
  })
  @IsArray()
  @IsNumber({}, { each: true }) // validate that every item is a number
  participant: number[];
}

export class GetChatByIdParamsDto {
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class PaginatedQueryRequestDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  @Type(() => Number)
  readonly limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  @Type(() => Number)
  readonly page?: number;
}
