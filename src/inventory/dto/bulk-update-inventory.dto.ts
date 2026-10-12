import { IsDateString, IsInt, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkUpdateInventoryDto {
  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  fromDate: string;

  @ApiProperty({ example: '2025-09-30' })
  @IsDateString()
  toDate: string;

  @ApiPropertyOptional({ example: 8 })
  @IsInt()
  @Min(0)
  @IsOptional()
  totalUnits?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsNumber()
  @IsOptional()
  priceOverride?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;
}
