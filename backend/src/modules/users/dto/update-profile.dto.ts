import { IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

// Self-service counterpart to UpdateUserDto, used by PATCH /users/me
// (UsersMeController) rather than the super_admin-only PATCH /users/:id.
// Deliberately a separate DTO rather than reusing UpdateUserDto: that one
// also declares `isActive`, which must never be settable by the user
// being (de)activated. Same reasoning as UpdateUserDto for omitting
// `role`/`schoolId`/`username` — those aren't user-editable at all, by
// anyone, through any route today.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string;
}
