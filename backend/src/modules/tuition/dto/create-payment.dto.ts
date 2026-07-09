import {
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsDateString()
  paidAt: string;

  @IsOptional()
  @IsString()
  note?: string;

  /**
   * Client-generated once per "submit" action (e.g. a UUID created when
   * the payment form is opened). If the same key is sent twice — a
   * double-click, a network retry — PaymentsService returns the original
   * payment instead of creating a second one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
