import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingUnit } from '@prisma/client';

export class CreateResourceCategoryDto {
  @ApiProperty({ example: 'Standard Room' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'STD-ROOM' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'rtype_accommodation' })
  @IsString()
  resourceTypeId: string;

  @ApiPropertyOptional({ example: 'Comfortable standard rooms with city view' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: BookingUnit, example: BookingUnit.NIGHT })
  @IsEnum(BookingUnit)
  @IsOptional()
  defaultBookingUnit?: BookingUnit;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultCapacity?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultMinimumDurationMinutes?: number;

  @ApiPropertyOptional({ example: 10080 })
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultMaximumDurationMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
