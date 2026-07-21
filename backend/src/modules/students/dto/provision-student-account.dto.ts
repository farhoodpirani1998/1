import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

// Input for StudentsService.provisionStudentAccount() -- creates the
// student-role User + StudentUser link a Student needs to log in (see
// AuthService.login's username path and ADR-001 Task 3A). Only the two
// login-specific fields belong here; everything else the User row needs
// (schoolId, fullName, role) is derived server-side from the Student
// record and the authenticated caller's own school, never taken from the
// request body.
export class ProvisionStudentAccountDto {
  // Matches the `username` column's length on User (see
  // AddUsernameToUsers migration). Restricted to letters/digits/dot/
  // underscore/hyphen, starting with a letter or digit -- same class of
  // constraint IsPhoneNumber gives the phone-based DTOs elsewhere, so a
  // request can't slip in whitespace or punctuation that would still
  // pass @IsString but produce a login identifier no admin could
  // reliably communicate or re-type.
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message: 'نام کاربری فقط می‌تواند شامل حروف، اعداد، نقطه، خط تیره و زیرخط باشد',
  })
  username: string;

  // Same minimum as RegisterDto.password -- one password policy for
  // every role's login, student included. MaxLength(72) matches
  // CreateStudentParentDto.password -- bcrypt silently ignores/errors on
  // input past 72 bytes, so this is capped consistently everywhere a
  // password is accepted.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
