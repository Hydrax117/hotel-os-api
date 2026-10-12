import { IsString, IsEmail, IsOptional } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  bookingId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  callbackUrl?: string;
}
