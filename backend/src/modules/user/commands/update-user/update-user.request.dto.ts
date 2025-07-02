import { IsEnum, IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export class EditUserRequestDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEmail()
  email?: string;

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
