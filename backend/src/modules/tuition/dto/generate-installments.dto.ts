import { IsInt, Min, Max, IsDateString } from 'class-validator';

export class GenerateInstallmentsDto {
  @IsInt()
  @Min(1)
  @Max(24)
  count: number;

  @IsDateString()
  startDate: string;

  @IsInt()
  @Min(1)
  intervalDays: number = 30;
}
