import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserRequestDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  )
  firstname?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  )
  lastname?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
