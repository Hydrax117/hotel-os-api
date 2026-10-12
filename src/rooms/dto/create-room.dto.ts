import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ enum: RoomStatus, example: RoomStatus.AVAILABLE })
  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;

  @ApiPropertyOptional({ example: 'Corner room with extra natural light' })
  @IsString()
  @IsOptional()
  notes?: string;
}
