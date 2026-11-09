import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoomServiceService } from './room-service.service.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { PlaceOrderDto } from './dto/place-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('room-service')
@Controller('room-service')
export class RoomServiceController {
  constructor(private readonly roomServiceService: RoomServiceService) {}

  // ─── Hotel management ─────────────────────────────────────────────────────

  /** Enable or disable room service for a hotel */
  @Patch('hotels/:hotelId/toggle')
  @UseGuards(JwtAuthGuard)
  toggleRoomService(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.roomServiceService.toggleRoomService(hotelId, user.userId, body.enabled);
  }

  /** List all venues for a hotel (hotel management) */
  @Get('hotels/:hotelId/venues')
  @UseGuards(JwtAuthGuard)
  getHotelVenues(@Param('hotelId') hotelId: string) {
    return this.roomServiceService.getHotelVenues(hotelId);
  }

  /** Create a new venue */
  @Post('hotels/:hotelId/venues')
  @UseGuards(JwtAuthGuard)
  createVenue(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: CreateVenueDto,
  ) {
    return this.roomServiceService.createVenue(hotelId, user.userId, dto);
  }

  /** Update a venue */
  @Patch('venues/:venueId')
  @UseGuards(JwtAuthGuard)
  updateVenue(
    @CurrentUser() user: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: Partial<CreateVenueDto>,
  ) {
    return this.roomServiceService.updateVenue(venueId, user.userId, dto);
  }

  /** Delete a venue */
  @Delete('venues/:venueId')
  @UseGuards(JwtAuthGuard)
  deleteVenue(@CurrentUser() user: JwtUser, @Param('venueId') venueId: string) {
    return this.roomServiceService.deleteVenue(venueId, user.userId);
  }

  /** Add a menu item to a venue */
  @Post('venues/:venueId/menu')
  @UseGuards(JwtAuthGuard)
  createMenuItem(
    @CurrentUser() user: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.roomServiceService.createMenuItem(venueId, user.userId, dto);
  }

  /** Update a menu item */
  @Patch('menu/:itemId')
  @UseGuards(JwtAuthGuard)
  updateMenuItem(
    @CurrentUser() user: JwtUser,
    @Param('itemId') itemId: string,
    @Body() dto: Partial<CreateMenuItemDto>,
  ) {
    return this.roomServiceService.updateMenuItem(itemId, user.userId, dto);
  }

  /** Delete a menu item */
  @Delete('menu/:itemId')
  @UseGuards(JwtAuthGuard)
  deleteMenuItem(@CurrentUser() user: JwtUser, @Param('itemId') itemId: string) {
    return this.roomServiceService.deleteMenuItem(itemId, user.userId);
  }

  /** Hotel staff: get all orders for a hotel */
  @Get('hotels/:hotelId/orders')
  @UseGuards(JwtAuthGuard)
  getHotelOrders(@CurrentUser() user: JwtUser, @Param('hotelId') hotelId: string) {
    return this.roomServiceService.getHotelOrders(hotelId, user.userId);
  }

  /** Hotel staff: update order status */
  @Patch('orders/:orderId/status')
  @UseGuards(JwtAuthGuard)
  updateOrderStatus(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.roomServiceService.updateOrderStatus(orderId, user.userId, dto);
  }

  // ─── Guest-facing ─────────────────────────────────────────────────────────

  /** Public: get venues + menus for a hotel (guests viewing what's available) */
  @Get('hotels/:hotelId/public')
  getPublicVenues(@Param('hotelId') hotelId: string) {
    return this.roomServiceService.getPublicVenues(hotelId);
  }

  /** Place an order (starts payment) */
  @Post('orders')
  @UseGuards(JwtAuthGuard)
  placeOrder(@CurrentUser() user: JwtUser, @Body() dto: PlaceOrderDto) {
    return this.roomServiceService.placeOrder(user.userId, dto);
  }

  /** Verify payment for an order */
  @Get('orders/verify/:reference')
  @UseGuards(JwtAuthGuard)
  verifyOrderPayment(
    @CurrentUser() user: JwtUser,
    @Param('reference') reference: string,
  ) {
    return this.roomServiceService.verifyOrderPayment(reference, user.userId);
  }

  /** Get current user's orders */
  @Get('orders/mine')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@CurrentUser() user: JwtUser, @Query('bookingId') bookingId?: string) {
    return this.roomServiceService.getMyOrders(user.userId, bookingId);
  }

  /** Get a single order */
  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  getOrder(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.roomServiceService.getOrderById(orderId, user.userId);
  }
}
