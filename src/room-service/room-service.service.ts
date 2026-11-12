import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, ServiceOrderStatus, ServicePaymentStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaystackService } from '../payments/paystack.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { type CreateVenueDto } from './dto/create-venue.dto.js';
import { type CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { type PlaceOrderDto } from './dto/place-order.dto.js';
import { type UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@Injectable()
export class RoomServiceService {
  private readonly logger = new Logger(RoomServiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ─── Hotel management ──────────────────────────────────────────────────────

  /** Toggle room service on/off for a hotel */
  async toggleRoomService(hotelId: string, ownerId: string, enabled: boolean) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.hotel.update({
      where: { id: hotelId },
      data: { roomServiceEnabled: enabled },
      select: { id: true, roomServiceEnabled: true },
    });
  }

  async createVenue(hotelId: string, ownerId: string, dto: CreateVenueDto) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException();
    if (!hotel.roomServiceEnabled) {
      throw new BadRequestException('Room service is not enabled for this hotel');
    }
    return this.prisma.serviceVenue.create({
      data: { hotelId, ...dto },
    });
  }

  async updateVenue(venueId: string, ownerId: string, dto: Partial<CreateVenueDto>) {
    const venue = await this.prisma.serviceVenue.findUnique({
      where: { id: venueId },
      include: { hotel: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.hotel.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.serviceVenue.update({ where: { id: venueId }, data: dto });
  }

  async deleteVenue(venueId: string, ownerId: string) {
    const venue = await this.prisma.serviceVenue.findUnique({
      where: { id: venueId },
      include: { hotel: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.hotel.ownerId !== ownerId) throw new ForbiddenException();
    await this.prisma.serviceVenue.delete({ where: { id: venueId } });
  }

  async getHotelVenues(hotelId: string) {
    return this.prisma.serviceVenue.findMany({
      where: { hotelId },
      include: { menuItems: { orderBy: { category: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createMenuItem(venueId: string, ownerId: string, dto: CreateMenuItemDto) {
    const venue = await this.prisma.serviceVenue.findUnique({
      where: { id: venueId },
      include: { hotel: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.hotel.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.serviceMenuItem.create({ data: { venueId, ...dto } });
  }

  async updateMenuItem(
    itemId: string,
    ownerId: string,
    dto: Partial<CreateMenuItemDto>,
  ) {
    const item = await this.prisma.serviceMenuItem.findUnique({
      where: { id: itemId },
      include: { venue: { include: { hotel: true } } },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    if (item.venue.hotel.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.serviceMenuItem.update({ where: { id: itemId }, data: dto });
  }

  async deleteMenuItem(itemId: string, ownerId: string) {
    const item = await this.prisma.serviceMenuItem.findUnique({
      where: { id: itemId },
      include: { venue: { include: { hotel: true } } },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    if (item.venue.hotel.ownerId !== ownerId) throw new ForbiddenException();
    await this.prisma.serviceMenuItem.delete({ where: { id: itemId } });
  }

  // ─── Guest order flow ──────────────────────────────────────────────────────

  /** Get venues + menus for a hotel (guest-facing, active only) */
  async getPublicVenues(hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (!hotel.roomServiceEnabled) {
      return { enabled: false, venues: [] };
    }
    const venues = await this.prisma.serviceVenue.findMany({
      where: { hotelId, isActive: true },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
    return { enabled: true, venues };
  }

  /**
   * Place an order and immediately initialize a Paystack payment.
   * Returns the Paystack authorization URL so the guest can pay now.
   */
  async placeOrder(
    userId: string,
    dto: PlaceOrderDto,
  ): Promise<{ orderId: string; paymentUrl: string; reference: string }> {
    // 1. Validate booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { hotel: true, user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('You can only order room service during an active stay');
    }

    // 2. Validate venue belongs to the same hotel
    const venue = await this.prisma.serviceVenue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue || venue.hotelId !== booking.hotelId) {
      throw new NotFoundException('Venue not found');
    }
    if (!venue.isActive) {
      throw new BadRequestException('This venue is currently unavailable');
    }

    // 3. Validate & price items
    if (!dto.items.length) throw new BadRequestException('Order must have at least one item');

    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.serviceMenuItem.findMany({
      where: { id: { in: menuItemIds }, venueId: dto.venueId },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items are invalid or not from this venue');
    }

    const unavailable = menuItems.filter((m) => !m.isAvailable);
    if (unavailable.length) {
      throw new BadRequestException(
        `The following items are currently unavailable: ${unavailable.map((m) => m.name).join(', ')}`,
      );
    }

    const itemMap = new Map(menuItems.map((m) => [m.id, m]));
    let totalNgn = 0;
    const orderItems = dto.items.map((i) => {
      const item = itemMap.get(i.menuItemId)!;
      const unitPrice = Number(item.priceNgn);
      const lineTotal = unitPrice * i.quantity;
      totalNgn += lineTotal;
      return {
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        unitPrice,
        lineTotal,
      };
    });

    // 4. Generate reference
    const reference = `HOS-SVC-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    // 5. Create order
    const order = await this.prisma.serviceOrder.create({
      data: {
        reference,
        bookingId: dto.bookingId,
        venueId: dto.venueId,
        userId,
        totalNgn,
        notes: dto.notes,
        roomNumber: dto.roomNumber,
        status: ServiceOrderStatus.PENDING,
        items: {
          create: orderItems,
        },
        payment: {
          create: {
            reference: `PAY-${reference}`,
            amountNgn: totalNgn,
            status: ServicePaymentStatus.PENDING,
          },
        },
      },
      include: { items: true, payment: true },
    });

    // 6. Initialize Paystack payment
    let paymentUrl: string;
    try {
      const result = await this.paystackService.initializeTransaction({
        email: booking.user.email,
        amount: totalNgn * 100, // kobo
        reference: `PAY-${reference}`,
        callbackUrl: dto.callbackUrl,
        metadata: { orderId: order.id, userId },
      });
      paymentUrl = result.authorizationUrl;
    } catch (err) {
      // Mark payment failed and cancel order on Paystack init failure
      await this.prisma.servicePayment.update({
        where: { orderId: order.id },
        data: { status: ServicePaymentStatus.FAILED },
      });
      await this.prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: ServiceOrderStatus.CANCELLED },
      });
      throw err;
    }

    return { orderId: order.id, paymentUrl, reference: `PAY-${reference}` };
  }

  /** Verify room service payment and confirm order */
  async verifyOrderPayment(reference: string, userId: string) {
    const payment = await this.prisma.servicePayment.findUnique({
      where: { reference },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.userId !== userId) throw new ForbiddenException();

    // Idempotent
    if (payment.status === ServicePaymentStatus.SUCCESS) {
      return { status: 'success', orderId: payment.orderId };
    }

    const result = await this.paystackService.verifyTransaction(reference);

    if (result.status === 'success') {
      await this.prisma.servicePayment.update({
        where: { id: payment.id },
        data: {
          status: ServicePaymentStatus.SUCCESS,
          paidAt: new Date(),
          providerRef: result.reference,
        },
      });

      // Fetch the full order (with venue/booking/items) to broadcast
      const confirmedOrder = await this.prisma.serviceOrder.update({
        where: { id: payment.orderId },
        data: { status: ServiceOrderStatus.CONFIRMED },
        include: {
          items: { include: { menuItem: { select: { name: true, category: true } } } },
          venue: { select: { name: true, type: true, hotelId: true } },
          booking: { select: { reference: true, guestFirstName: true, guestLastName: true } },
          payment: { select: { status: true, paidAt: true } },
        },
      });

      // 🔔 Real-time push to hotel dashboard
      this.notificationsGateway.notifyNewOrder(confirmedOrder.venue.hotelId, {
        type: 'room-service-order',
        orderId: confirmedOrder.id,
        reference: confirmedOrder.reference,
        guestName: `${confirmedOrder.booking.guestFirstName} ${confirmedOrder.booking.guestLastName}`,
        venueName: confirmedOrder.venue.name,
        items: confirmedOrder.items.map(i => ({
          name: i.menuItem?.name,
          quantity: i.quantity,
          lineTotal: Number(i.lineTotal),
        })),
        totalNgn: Number(confirmedOrder.totalNgn),
        notes: confirmedOrder.notes,
        roomNumber: confirmedOrder.roomNumber,
        status: confirmedOrder.status,
      });

      return { status: 'success', orderId: payment.orderId };
    }

    await this.prisma.servicePayment.update({
      where: { id: payment.id },
      data: { status: ServicePaymentStatus.FAILED, failedAt: new Date() },
    });
    await this.prisma.serviceOrder.update({
      where: { id: payment.orderId },
      data: { status: ServiceOrderStatus.CANCELLED },
    });
    return { status: 'failed', orderId: payment.orderId };
  }

  async getMyOrders(userId: string, bookingId?: string) {
    return this.prisma.serviceOrder.findMany({
      where: { userId, ...(bookingId && { bookingId }) },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
        venue: { select: { name: true, type: true } },
        payment: { select: { status: true, paidAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string, userId: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        venue: true,
        payment: true,
        booking: { select: { reference: true, guestFirstName: true, guestLastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    // Allow guest or hotel staff to view
    if (order.userId !== userId) {
      // Check if the user is hotel staff
      const venue = await this.prisma.serviceVenue.findUnique({
        where: { id: order.venueId },
        include: { hotel: { include: { staff: true } } },
      });
      const isOwner = venue?.hotel.ownerId === userId;
      const isStaff = venue?.hotel.staff.some((s) => s.userId === userId && s.isActive);
      if (!isOwner && !isStaff) throw new ForbiddenException();
    }
    return order;
  }

  // ─── Hotel order management ─────────────────────────────────────────────────

  async getHotelOrders(hotelId: string, staffId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { staff: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');
    const isOwner = hotel.ownerId === staffId;
    const isStaff = hotel.staff.some((s) => s.userId === staffId && s.isActive);
    if (!isOwner && !isStaff) throw new ForbiddenException();

    return this.prisma.serviceOrder.findMany({
      where: { venue: { hotelId } },
      include: {
        items: { include: { menuItem: { select: { name: true, category: true } } } },
        venue: { select: { name: true, type: true } },
        payment: { select: { status: true } },
        booking: { select: { reference: true, guestFirstName: true, guestLastName: true, roomType: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrderStatus(orderId: string, staffId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { venue: { include: { hotel: { include: { staff: true } } } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isOwner = order.venue.hotel.ownerId === staffId;
    const isStaff = order.venue.hotel.staff.some((s) => s.userId === staffId && s.isActive);
    if (!isOwner && !isStaff) throw new ForbiddenException();

    // Validate transitions
    const VALID_TRANSITIONS: Partial<Record<ServiceOrderStatus, ServiceOrderStatus[]>> = {
      [ServiceOrderStatus.CONFIRMED]: [ServiceOrderStatus.PREPARING, ServiceOrderStatus.CANCELLED],
      [ServiceOrderStatus.PREPARING]: [ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED],
    };

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${dto.status}`,
      );
    }

    return this.prisma.serviceOrder.update({
      where: { id: orderId },
      data: { status: dto.status },
    }).then(updated => {
      // 🔔 Broadcast status change to hotel dashboard AND the guest
      this.notificationsGateway.notifyOrderStatusUpdate(order.venue.hotelId, {
        type: 'room-service-order-updated',
        orderId: updated.id,
        status: updated.status,
      }, order.userId);
      return updated;
    });
  }
}
