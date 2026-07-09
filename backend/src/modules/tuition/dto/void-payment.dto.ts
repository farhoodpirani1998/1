import { IsString, MinLength, MaxLength } from 'class-validator';

export class VoidPaymentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}
