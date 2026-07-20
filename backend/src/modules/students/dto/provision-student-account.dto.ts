import { IsString, MinLength, MaxLength } from 'class-validator';

// Input for StudentsService.provisionStudentAccount() -- creates the
// student-role User + StudentUser link a Student needs to log in (see
// AuthService.login's username path and ADR-001 Task 3A). Only the two
// login-specific fields belong here; everything else the User row needs
// (schoolId, fullName, role) is derived server-side from the Student
// record and the authenticated caller's own school, never taken from the
// request body.
export class ProvisionStudentAccountDto {
  // Matches the `username` column's length on User (see
  // AddUsernameToUsers migration).
  @IsString()
  @MaxLength(50)
  username: string;

  // Same minimum as RegisterDto.password -- one password policy for
  // every role's login, student included.
  @IsString()
  @MinLength(8)
  password: string;
}
