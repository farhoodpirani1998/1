import { IsInt, Min, IsDateString } from 'class-validator';

export class AddInstallmentDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsDateString()
  dueDate: string;
}
