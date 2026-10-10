import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';

export class ApproveHotelDto {
  @ApiProperty({ enum: VerificationStatus, example: VerificationStatus.APPROVED })
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @ApiPropertyOptional({ example: 'All documents verified and in order.' })
  @IsString()
  @IsOptional()
  notes?: string;
}
