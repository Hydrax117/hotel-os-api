import { IsString, IsOptional } from 'class-validator';

export class CancelBookingDto {
  @IsString() @IsOptional() reason?: string;
}
