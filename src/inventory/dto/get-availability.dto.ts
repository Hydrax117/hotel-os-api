import { IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetAvailabilityDto {
  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2025-09-05' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  guests: number;
}
