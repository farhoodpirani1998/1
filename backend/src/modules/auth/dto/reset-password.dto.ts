import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  // Same 8-char minimum as RegisterDto.password / ChangePasswordDto.newPassword.
  @IsString()
  @MinLength(8)
  newPassword: string;
}
