import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';

export class HotelQueryDto {
  @ApiPropertyOptional({ example: 'Lagos' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos State' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'Eko' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  @IsOptional()
  status?: VerificationStatus;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
