import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: RoomStatus, example: RoomStatus.MAINTENANCE })
  @IsEnum(RoomStatus)
  status: RoomStatus;

  @ApiPropertyOptional({ example: 'HVAC repair in progress' })
  @IsString()
  @IsOptional()
  notes?: string;
}
