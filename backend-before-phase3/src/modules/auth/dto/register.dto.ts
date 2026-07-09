import {
  IsString,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  IsUUID,
  IsIn,
  IsOptional,
} from 'class-validator';

// Only super_admin can create school_admin/accountant/staff users; the
// endpoint is guarded by @Roles('super_admin') in AuthController.
export class RegisterDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string; // omitted only when creating a super_admin

  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsPhoneNumber('IR')
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(['super_admin', 'school_admin', 'accountant', 'staff'])
  role: string;
}
