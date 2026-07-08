import { IsString, MaxLength, IsOptional, IsPhoneNumber } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string;
}
