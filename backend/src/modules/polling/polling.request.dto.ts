import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class SendMessageRequestDto {
  @IsString()
  @MaxLength(10000)
  readonly content: string;

  @IsOptional()
  @IsUUID()
  readonly attachmentId?: string;

  @IsNotEmpty({ message: 'chatId is required' })
  @IsNumber()
  readonly chatId: number;
}

export class CreateChatRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  readonly firstMessage?: string;

  @IsOptional()
  @IsBoolean()
  readonly isGroup?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  participant: number[];
}

export class UpdateGroupRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class AddGroupMembersRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  participant: number[];
}

export class GetChatByIdParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
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

export class GroupMemberParamsDto extends GetChatByIdParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId: number;
}
