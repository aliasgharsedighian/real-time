import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
export class SharedContentDto {
  @IsOptional()
  @IsIn(['IMAGE', 'VIDEO', 'AUDIO', 'MUSIC', 'LINK'])
  kind?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MUSIC' | 'LINK';
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  beforeId?: number;
}
