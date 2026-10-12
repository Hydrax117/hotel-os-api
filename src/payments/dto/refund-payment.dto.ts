import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class RefundPaymentDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  amountNgn?: number;
}
