import { IsString, MinLength, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Opera PMS Integration' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: '2027-12-31T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
