import { IsString, MinLength, ValidateIf } from 'class-validator';

// ADR-001 Task 3A: login now accepts either identifier -- `phone` (every
// existing role, unchanged) or `username` (student-role logins, see
// AuthService.login). Exactly one of the two must be present; ValidateIf
// makes each conditional on the other being absent rather than making
// both plain-optional, so a request with neither (or, just as invalid,
// both) still fails validation instead of silently falling through to
// whichever field happens to be truthy.
export class LoginDto {
  @ValidateIf((dto: LoginDto) => !dto.username)
  @IsString()
  phone?: string;

  @ValidateIf((dto: LoginDto) => !dto.phone)
  @IsString()
  username?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
