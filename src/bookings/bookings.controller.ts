import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CreateWalkInDto } from './dto/create-walk-in.dto.js';
import { CancelBookingDto } from './dto/cancel-booking.dto.js';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getMyBookings(@CurrentUser() user: JwtUser, @Query() query: BookingQueryDto) {
    return this.bookingsService.getMyBookings(user.userId, query);
  }

  // MUST be before /:id to avoid route conflict
  @Get('hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  getHotelBookings(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.getHotelBookings(hotelId, user.userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getBookingById(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bookingsService.getBookingById(id, user.userId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(id, user.userId, dto);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bookingsService.confirmBooking(id, user.userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateBookingStatus(id, user.userId, dto);
  }

  /**
   * Check availability for extending a stay.
   * GET /api/v1/bookings/:id/extension/check?newCheckOut=YYYY-MM-DD
   */
  @Get(':id/extension/check')
  @UseGuards(JwtAuthGuard)
  checkExtension(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('newCheckOut') newCheckOut: string,
  ) {
    return this.bookingsService.checkExtensionAvailability(id, user.userId, newCheckOut);
  }

  /**
   * Confirm and apply a stay extension (called after payment succeeds).
   * POST /api/v1/bookings/:id/extension
   */
  @Post(':id/extension')
  @UseGuards(JwtAuthGuard)
  confirmExtension(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { newCheckOut: string },
  ) {
    return this.bookingsService.confirmExtension(id, user.userId, body.newCheckOut);
  }

  /**
   * Walk-in booking: hotel staff creates a booking for a guest who arrives in person.
   * No payment required — booking goes straight to CHECKED_IN.
   * POST /api/v1/bookings/hotel/:hotelId/walk-in
   */
  @Post('hotel/:hotelId/walk-in')
  @UseGuards(JwtAuthGuard)
  createWalkIn(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: CreateWalkInDto,
  ) {
    return this.bookingsService.createWalkIn(hotelId, user.userId, dto);
  }
}
