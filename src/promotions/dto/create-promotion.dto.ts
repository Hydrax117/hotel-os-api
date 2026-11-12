import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsDateString, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreatePromotionDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  discountValue: number;

  @ApiProperty({ description: 'ISO date string YYYY-MM-DD' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ description: 'ISO date string YYYY-MM-DD' })
  @IsDateString()
  validTo: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minNights?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceBookingDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePromotionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  discountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  minNights?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceBookingDays?: number;
}
