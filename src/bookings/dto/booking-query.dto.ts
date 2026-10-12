import { IsEnum, IsDateString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';

export class BookingQueryDto {
  @IsEnum(BookingStatus) @IsOptional() status?: BookingStatus;
  @IsDateString() @IsOptional() checkIn?: string;
  @IsDateString() @IsOptional() checkOut?: string;
  @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @IsInt() @Min(1) @Max(50) @IsOptional() @Type(() => Number) limit?: number;
}
