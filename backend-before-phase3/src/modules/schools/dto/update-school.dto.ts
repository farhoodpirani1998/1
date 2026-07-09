import { IsString, MaxLength, IsOptional, IsPhoneNumber, IsBoolean } from 'class-validator';

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
