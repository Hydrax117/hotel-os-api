import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InventoryService } from './inventory.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';
import { GetCalendarDto } from './dto/get-calendar.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class CreateBlockDto {
  @ApiPropertyOptional() @IsDateString() startAt: string;
  @ApiPropertyOptional() @IsDateString() endAt: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

@ApiTags('inventory')
@Controller('resources/:resourceId/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Check resource availability for a date range (public)' })
  checkAvailability(
    @Param('resourceId') resourceId: string,
    @Query() dto: GetAvailabilityDto,
  ) {
    return this.inventoryService.checkAvailability(resourceId, dto);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get availability calendar for a resource (public)' })
  @ApiQuery({ name: 'from', required: true, example: '2026-12-01' })
  @ApiQuery({ name: 'to',   required: true, example: '2026-12-31' })
  getCalendar(
    @Param('resourceId') resourceId: string,
    @Query() dto: GetCalendarDto,
  ) {
    return this.inventoryService.getCalendar(resourceId, dto.from, dto.to);
  }

  @Post('blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create availability block (owner only)' })
  createBlock(
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBlockDto,
  ) {
    return this.inventoryService.createBlock(resourceId, user.userId, {
      startAt: new Date(dto.startAt),
      endAt:   new Date(dto.endAt),
      reason:  dto.reason,
      notes:   dto.notes,
    });
  }

  @Get('blocks')
  @ApiOperation({ summary: 'List availability blocks for a resource (public)' })
  listBlocks(@Param('resourceId') resourceId: string) {
    return this.inventoryService.listBlocks(resourceId);
  }

  @Delete('blocks/:blockId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete availability block (owner only)' })
  deleteBlock(
    @Param('blockId') blockId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.inventoryService.deleteBlock(blockId, user.userId);
  }
}
