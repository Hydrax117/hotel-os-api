import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ResourceLifecycleStatus,
  ResourceOperationalStatus,
  ResourceMarketplaceVisibility,
  BookingUnit,
} from '@prisma/client';

export class ResourceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by building ID' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Filter by floor ID' })
  @IsString()
  @IsOptional()
  floorId?: string;

  @ApiPropertyOptional({ enum: ResourceLifecycleStatus })
  @IsEnum(ResourceLifecycleStatus)
  @IsOptional()
  lifecycleStatus?: ResourceLifecycleStatus;

  @ApiPropertyOptional({ enum: ResourceOperationalStatus })
  @IsEnum(ResourceOperationalStatus)
  @IsOptional()
  operationalStatus?: ResourceOperationalStatus;

  @ApiPropertyOptional({ enum: ResourceMarketplaceVisibility })
  @IsEnum(ResourceMarketplaceVisibility)
  @IsOptional()
  marketplaceVisibility?: ResourceMarketplaceVisibility;

  @ApiPropertyOptional({ enum: BookingUnit })
  @IsEnum(BookingUnit)
  @IsOptional()
  bookingUnit?: BookingUnit;

  @ApiPropertyOptional({ description: 'Filter bookable resources only' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;
}
