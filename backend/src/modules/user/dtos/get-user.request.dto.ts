import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUserParamsDto {
  @Type(() => Number)
  @IsInt()
  id: number;
}
