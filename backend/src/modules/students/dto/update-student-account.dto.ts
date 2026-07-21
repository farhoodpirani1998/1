import { IsBoolean, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

// Input for StudentsService.updateAccount() -- PATCH /students/:id/account.
// Same "one PATCH, any combination of optional fields" shape as
// UpdateUserDto: a caller can send just { isActive } (enable/disable
// portal access), just { newPassword } (reset credentials), or both in
// one request, matching how the two actions are exposed as separate
// buttons in the admin UI but don't need separate routes.
export class UpdateStudentAccountDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Same policy as ProvisionStudentAccountDto.password -- MinLength(8)
  // to match every other role's password rule, MaxLength(72) since
  // bcrypt silently ignores/errors on input past 72 bytes.
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword?: string;
}
