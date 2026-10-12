import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { AdminHotelQueryDto } from './dto/admin-hotel-query.dto.js';
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto.js';
import { AdminApproveHotelDto } from './dto/approve-hotel.dto.js';
import { SuspendHotelDto } from './dto/suspend-hotel.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('revenue')
  getRevenueStats(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.adminService.getRevenueStats(fromDate, toDate);
  }

  @Get('hotels')
  getHotels(@Query() query: AdminHotelQueryDto) {
    return this.adminService.getHotels(query);
  }

  @Get('hotels/:id')
  getHotelDetail(@Param('id') id: string) {
    return this.adminService.getHotelDetail(id);
  }

  @Post('hotels/:id/approve')
  approveHotel(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AdminApproveHotelDto,
  ) {
    return this.adminService.approveHotel(id, user.userId, dto);
  }

  @Post('hotels/:id/suspend')
  suspendHotel(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: SuspendHotelDto,
  ) {
    return this.adminService.suspendHotel(id, user.userId, dto.reason);
  }

  @Get('users')
  getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Post('users/:id/reactivate')
  reactivateUser(@Param('id') id: string) {
    return this.adminService.reactivateUser(id);
  }

  @Get('bookings')
  getAllBookings(@Query() query: AdminBookingQueryDto) {
    return this.adminService.getAllBookings(query);
  }
}
