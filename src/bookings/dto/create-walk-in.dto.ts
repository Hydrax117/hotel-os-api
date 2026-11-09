import {
  IsString,
  IsEmail,
  IsInt,
  IsDateString,
  Min,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWalkInDto {
  @ApiProperty({ example: 'room-type-id' })
  @IsString()
  roomTypeId: string;

  @ApiProperty({ example: '2026-11-09' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-11-11' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  guests: number;

  @ApiProperty({ example: 'Amaka' })
  @IsString()
  @MinLength(1)
  guestFirstName: string;

  @ApiProperty({ example: 'Obi' })
  @IsString()
  @MinLength(1)
  guestLastName: string;

  @ApiProperty({ example: 'amaka@example.com' })
  @IsEmail()
  guestEmail: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  guestPhone: string;

  @ApiPropertyOptional({ example: 'Non-smoking room please' })
  @IsString()
  @IsOptional()
  specialRequests?: string;
}
