import { IsEnum, IsString, IsOptional } from 'class-validator';
import { VerificationStatus } from '@prisma/client';

export class AdminApproveHotelDto {
  @IsEnum(VerificationStatus)
  status!: VerificationStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
