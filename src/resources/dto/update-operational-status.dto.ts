import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceOperationalStatus } from '@prisma/client';

export class UpdateOperationalStatusDto {
  @ApiProperty({ enum: ResourceOperationalStatus })
  @IsEnum(ResourceOperationalStatus)
  operationalStatus: ResourceOperationalStatus;

  @ApiPropertyOptional({ example: 'Deep clean required after long-stay guest' })
  @IsString()
  @IsOptional()
  notes?: string;
}
