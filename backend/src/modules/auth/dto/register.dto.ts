import {
  IsString,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  IsUUID,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../../common/authorization/roles.enum';

// Only super_admin can create school_admin/accountant/staff/parent users;
// the endpoint is guarded by @Roles('super_admin') in AuthController.
export class RegisterDto {
  // schoolId is required for every role except super_admin — a
  // school_admin/accountant/staff row with no school_id would be a user
  // with no tenant to belong to. ValidateIf skips @IsUUID (so it's still
  // fine to omit for super_admin), but any other role omitting or
  // nulling it fails validation instead of silently creating an orphaned
  // user (see also AuthService.register's belt-and-suspenders check).
  @ValidateIf((dto: RegisterDto) => dto.role !== Role.SUPER_ADMIN)
  @IsUUID()
  schoolId?: string;

  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsPhoneNumber('IR')
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Sourced from Role so a role can never be added/renamed in one place
  // and forgotten in the other.
  @IsIn(Object.values(Role))
  role: string;
}
