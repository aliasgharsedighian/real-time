import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
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
