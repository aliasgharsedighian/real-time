import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserRequestDto {
  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  )
  firstname?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  )
  lastname?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
