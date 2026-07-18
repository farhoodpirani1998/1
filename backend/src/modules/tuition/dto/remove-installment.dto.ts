import { IsString, MinLength, MaxLength } from 'class-validator';

export class RemoveInstallmentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}
