import { IsString, IsPhoneNumber, MaxLength, IsOptional } from 'class-validator';

export class CreateGuardianDto {
  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsPhoneNumber('IR')
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;
}
