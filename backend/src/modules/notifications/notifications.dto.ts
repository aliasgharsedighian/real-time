import { IsString, IsUUID, Length } from 'class-validator';

export class RegisterPushDto {
  @IsUUID('4')
  installationId: string;

  @IsString()
  @Length(20, 4096)
  token: string;
}
