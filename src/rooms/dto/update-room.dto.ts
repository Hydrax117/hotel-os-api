import { IsInt, IsString, IsOptional, IsEnum } from 'class-validator';
import { RoomStatus } from '@prisma/client';

/**
 * Standalone DTO for updating a room's mutable fields.
 * `number` is intentionally excluded — room numbers are immutable after creation
 * to prevent silent P2002 unique-constraint errors on the roomTypeId_number index.
 */
export class UpdateRoomDto {
  @IsInt()
  @IsOptional()
  floor?: number;

  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
