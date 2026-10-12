import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RoomsService } from './rooms.service.js';
import { CreateRoomTypeDto } from './dto/create-room-type.dto.js';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('rooms')
@Controller('hotels/:hotelId/room-types')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  // ─── Room Types ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all room types for a hotel (public)' })
  @ApiResponse({ status: 200 })
  getRoomTypes(@Param('hotelId') hotelId: string) {
    return this.roomsService.getRoomTypes(hotelId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a room type (owner only)' })
  @ApiResponse({ status: 201 })
  createRoomType(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomsService.createRoomType(hotelId, user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room type by ID (public)' })
  @ApiResponse({ status: 200 })
  getRoomTypeById(@Param('id') id: string) {
    return this.roomsService.getRoomTypeById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a room type (owner only)' })
  updateRoomType(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.roomsService.updateRoomType(id, user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a room type (owner only)' })
  deleteRoomType(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.roomsService.deleteRoomType(id, user.userId);
  }

  // ─── Physical Rooms ────────────────────────────────────────────────────────

  @Get(':id/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List physical rooms for a room type (owner only)' })
  getRooms(@Param('id') roomTypeId: string) {
    return this.roomsService.getRooms(roomTypeId);
  }

  @Post(':id/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a physical room to a room type (owner only)' })
  @ApiResponse({ status: 201 })
  createRoom(
    @Param('id') roomTypeId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(roomTypeId, user.userId, dto);
  }

  @Patch(':id/rooms/:roomId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update room status (owner only)' })
  updateRoomStatus(
    @Param('roomId') roomId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateRoomStatus(roomId, user.userId, dto);
  }

  @Delete(':id/rooms/:roomId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a physical room (owner only)' })
  deleteRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.roomsService.deleteRoom(roomId, user.userId);
  }
}
