import { IsNotEmpty, IsString } from 'class-validator';

export class FindUserByEmailRequestDto {
  @IsNotEmpty({ message: 'search is required' })
  @IsString()
  readonly search: string;
}
