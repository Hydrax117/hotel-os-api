import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsObject,
  ValidateNested,
  ArrayMinSize,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingUnit, ResourceMarketplaceVisibility } from '@prisma/client';

export class BulkResourceItemDto {
  @ApiProperty({ example: 'Room 101' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '101' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: { bedConfiguration: 'KING' } })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}

export class BulkCreateResourcesDto {
  @ApiProperty({ example: 'cat_id_here' })
  @IsString()
  resourceCategoryId: string;

  @ApiPropertyOptional({ example: 'bld_id_here' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiPropertyOptional({ example: 'floor_id_here' })
  @IsString()
  @IsOptional()
  floorId?: string;

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

  @ApiProperty({ type: [BulkResourceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkResourceItemDto)
  resources: BulkResourceItemDto[];
}
