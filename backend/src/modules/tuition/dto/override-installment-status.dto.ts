import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { InstallmentStatus } from '../entities/installment.entity';

export class OverrideInstallmentStatusDto {
  @IsEnum(InstallmentStatus)
  status: InstallmentStatus;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}
