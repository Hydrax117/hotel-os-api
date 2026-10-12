import { IsEnum, IsString, IsOptional } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus) status: BookingStatus;
  @IsString() @IsOptional() reason?: string;
}
