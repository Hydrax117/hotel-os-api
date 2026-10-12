import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Deluxe King' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Spacious room with king-sized bed and city view' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'King' })
  @IsString()
  bedType: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  capacity: number;

  @ApiPropertyOptional({ example: 35.5 })
  @IsNumber()
  @IsOptional()
  sizeSqm?: number;

  @ApiProperty({ example: 45000 })
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  totalRooms: number;
}
