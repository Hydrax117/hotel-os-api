import { IsString, IsNumber, IsOptional } from 'class-validator';

export class RefundPaymentDto {
  @IsString()
  reason!: string;

  @IsNumber()
  @IsOptional()
  amountNgn?: number;
}
