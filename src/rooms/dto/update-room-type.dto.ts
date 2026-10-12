import { PartialType } from '@nestjs/swagger';
import { CreateRoomTypeDto } from './create-room-type.dto.js';

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}
