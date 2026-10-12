import { IsEnum, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationStatus } from '@prisma/client';

export class AdminHotelQueryDto {
  @IsEnum(VerificationStatus)
  @IsOptional()
  status?: VerificationStatus;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
