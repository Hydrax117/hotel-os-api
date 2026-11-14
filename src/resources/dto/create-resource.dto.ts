import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsObject,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingUnit, ResourceMarketplaceVisibility } from '@prisma/client';

export class CreateResourceDto {
  @ApiProperty({ example: 'Room 101' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '101', description: 'Unique code within the hotel' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'cat_id_here', description: 'ResourceCategory ID' })
  @IsString()
  resourceCategoryId: string;

  @ApiPropertyOptional({ example: 'bld_id_here', description: 'Building ID (optional)' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ example: 'floor_id_here', description: 'Floor ID (optional)' })
  @IsString()
  @IsOptional()
  floorId?: string;

  @ApiPropertyOptional({ example: 'Spacious corner room with sea view' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: BookingUnit, example: BookingUnit.NIGHT })
  @IsEnum(BookingUnit)
  @IsOptional()
  bookingUnit?: BookingUnit;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @ApiPropertyOptional({
    enum: ResourceMarketplaceVisibility,
    example: ResourceMarketplaceVisibility.PRIVATE,
  })
  @IsEnum(ResourceMarketplaceVisibility)
  @IsOptional()
  marketplaceVisibility?: ResourceMarketplaceVisibility;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  minimumCapacity?: number;

  @ApiPropertyOptional({ example: 60, description: 'Minimum booking duration in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  minimumDurationMinutes?: number;

  @ApiPropertyOptional({ example: 10080, description: 'Maximum booking duration in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  maximumDurationMinutes?: number;

  @ApiPropertyOptional({ example: 30, description: 'Buffer before booking in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bufferBeforeMinutes?: number;

  @ApiPropertyOptional({ example: 30, description: 'Buffer after booking in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bufferAfterMinutes?: number;

  @ApiPropertyOptional({
    example: { bedConfiguration: 'KING', bathroom: 'PRIVATE' },
    description: 'Flexible resource attributes (bed config, amenities, etc.)',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Corner unit — good light' })
  @IsString()
  @IsOptional()
  internalNotes?: string;
}
