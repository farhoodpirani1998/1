import { IsString, IsPhoneNumber, MinLength, MaxLength } from 'class-validator';

// POST /students/:id/parent — school_admin/staff creates (or reuses, if
// the phone number already belongs to a parent-role account in this
// school — e.g. a sibling's parent) a parent-portal login and links it
// to this student in one step. Mirrors RegisterDto's fullName/phone
// shape; password is required here (unlike RegisterDto has no optional
// path) since this always creates-or-links a real login.
export class CreateStudentParentDto {
  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsPhoneNumber('IR')
  phone: string;

  // Same MinLength(8) as RegisterDto.password — this ultimately creates
  // the exact same kind of login (or reuses one), just via a different
  // entry point.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
