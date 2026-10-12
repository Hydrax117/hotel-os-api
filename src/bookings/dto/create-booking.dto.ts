import { IsString, IsDateString, IsInt, Min, IsEmail, IsOptional, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsString() hotelId: string;
  @IsString() roomTypeId: string;
  @IsDateString() checkIn: string;
  @IsDateString() checkOut: string;
  @IsInt() @Min(1) guests: number;
  @IsString() @MinLength(1) guestFirstName: string;
  @IsString() @MinLength(1) guestLastName: string;
  @IsEmail() guestEmail: string;
  @IsString() guestPhone: string;
  @IsString() @IsOptional() specialRequests?: string;
}
