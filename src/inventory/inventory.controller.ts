import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InventoryService } from './inventory.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';
import { GetCalendarDto } from './dto/get-calendar.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { BulkUpdateInventoryDto } from './dto/bulk-update-inventory.dto.js';
import { EnsureInventoryDto } from './dto/ensure-inventory.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('inventory')
@Controller('room-types/:roomTypeId/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  @Get('availability')
  @ApiOperation({ summary: 'Check room type availability for a date range (public)' })
  @ApiResponse({ status: 200 })
  checkAvailability(
    @Param('roomTypeId') roomTypeId: string,
    @Query() dto: GetAvailabilityDto,
  ) {
    return this.inventoryService.checkAvailability(roomTypeId, dto);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get inventory calendar for a room type (public)' })
  @ApiQuery({ name: 'from', required: true, example: '2025-09-01' })
  @ApiQuery({ name: 'to', required: true, example: '2025-09-30' })
  getCalendar(
    @Param('roomTypeId') roomTypeId: string,
    @Query() dto: GetCalendarDto,
  ) {
    return this.inventoryService.getCalendar(roomTypeId, dto.from, dto.to);
  }

  // ─── Hotel Owner ───────────────────────────────────────────────────────────

  @Patch('day')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a single inventory day (owner only)' })
  updateInventoryDay(
    @Param('roomTypeId') roomTypeId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateInventoryDay(roomTypeId, user.userId, dto);
  }

  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update inventory over a date range (owner only)' })
  bulkUpdateInventory(
    @Param('roomTypeId') roomTypeId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkUpdateInventoryDto,
  ) {
    return this.inventoryService.bulkUpdateInventory(roomTypeId, user.userId, dto);
  }

  @Post('ensure')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pre-populate inventory days (owner only)' })
  @ApiResponse({ status: 201 })
  ensureInventoryExists(
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: EnsureInventoryDto,
  ) {
    return this.inventoryService.ensureInventoryExists(roomTypeId, dto.days);
  }
}
