import { IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class UpdateInstallmentDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;
}
