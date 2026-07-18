import { IsString, MinLength } from 'class-validator';

// Same 8-char minimum as RegisterDto.password and ChangePasswordDto.newPassword
// — one password policy across create/change/reset.
export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}
