import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { GetChatByIdParamsDto } from './polling.request.dto';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
  Min,
} from 'class-validator';
export class MessageIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  messageIds: number[];
}
export class ForwardMessagesDto extends MessageIdsDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  targetChatId: number;
}
export class EditMessageDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  messageId: number;
  @IsString()
  @MaxLength(10000)
  content: string;
}
export class MuteChatDto {
  @IsBoolean()
  muted: boolean;
}

export class SyncMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  messageIds: number[];
}

export class MessageReadersParamsDto extends GetChatByIdParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  messageId: number;
}

export class SetReactionDto {
  @ApiProperty({ type: String, nullable: true, example: '👍' })
  @ValidateIf((_body, value) => value !== null)
  @IsString()
  @MaxLength(32)
  @Matches(
    /^\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*$/u,
  )
  emoji: string | null;
}
