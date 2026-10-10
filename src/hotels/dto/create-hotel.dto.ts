import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsArray,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHotelDto {
  @ApiProperty({ example: 'Eko Hotel & Suites' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'A premium 5-star hotel located in the heart of Lagos...' })
  @IsString()
  @MinLength(20)
  description: string;

  @ApiProperty({ example: '1415 Adeola Odeku Street, Victoria Island' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Lagos State' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: 6.4281 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.4219 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: '+234 1 123 4567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'reservations@ekohotels.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsString()
  @IsOptional()
  checkInTime?: string;

  @ApiPropertyOptional({ example: '12:00' })
  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @ApiPropertyOptional({ type: [String], example: ['amenity-id-1', 'amenity-id-2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenityIds?: string[];
}
