import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortBy {
  RECOMMENDED = 'recommended',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING = 'rating',
}

export class SearchHotelsDto {
  @ApiPropertyOptional({ description: 'Filter by city (partial match)' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by state (partial match)' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Full-text search on hotel name' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ example: '2025-09-01' })
  @IsDateString()
  @IsOptional()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2025-09-05' })
  @IsDateString()
  @IsOptional()
  checkOut?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  guests?: number;

  @ApiPropertyOptional({ description: 'Minimum price per night' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price per night' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({ type: [String], description: 'Required amenities' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : undefined,
  )
  amenities?: string[];

  @ApiPropertyOptional({ enum: SortBy })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
