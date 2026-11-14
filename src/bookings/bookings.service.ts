import {
  Injectable, Logger, Inject, forwardRef,
  NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, type Booking, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { type CreateBookingDto } from './dto/create-booking.dto.js';
import { type CreateWalkInDto } from './dto/create-walk-in.dto.js';
import { type CancelBookingDto } from './dto/cancel-booking.dto.js';
import { type UpdateBookingStatusDto } from './dto/update-booking-status.dto.js';
import { type BookingQueryDto } from './dto/booking-query.dto.js';

const bookingInclude = {
  hotel: true,
  resource: {
    include: {
      images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
      category: { include: { resourceType: true } },
    },
  },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private generateReference(): string {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `HOS-${num}`;
  }

  private calcPricing(pricePerNight: number, nights: number) {
    const subtotal = pricePerNight * nights;
    const serviceFee = Math.round(subtotal * 0.03);
    return { subtotalNgn: subtotal, serviceFeeNgn: serviceFee, totalNgn: subtotal + serviceFee };
  }

  async createBooking(userId: string, dto: CreateBookingDto): Promise<Booking> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } });
    if (!hotel || !hotel.isActive || !hotel.isPublished) throw new NotFoundException('Hotel not found');

    const resource = await this.prisma.resource.findUnique({ where: { id: dto.resourceId } });
    if (!resource || resource.hotelId !== dto.hotelId) throw new NotFoundException('Resource not found');
    if (!resource.isBookable || resource.lifecycleStatus !== 'ACTIVE') {
      throw new BadRequestException('This resource is not bookable');
    }

    const checkInDate  = new Date(dto.checkIn  + 'T00:00:00Z');
    const checkOutDate = new Date(dto.checkOut + 'T00:00:00Z');
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000);
    if (nights < 1) throw new BadRequestException('Check-out must be after check-in');

    const avail = await this.inventoryService.checkAvailability(dto.resourceId, {
      checkIn: dto.checkIn, checkOut: dto.checkOut, guests: dto.guests,
    });
    if (!avail.available) throw new BadRequestException('Resource unavailable for selected dates');

    const pricing = this.calcPricing(0, nights); // rate plans not yet wired

    let reference: string;
    do { reference = this.generateReference(); }
    while (await this.prisma.booking.findUnique({ where: { reference } }));

    const booking = await this.prisma.booking.create({
      data: {
        reference, userId,
        hotelId:    dto.hotelId,
        resourceId: dto.resourceId,
        checkIn:    checkInDate,
        checkOut:   checkOutDate,
        nights,
        guests:         dto.guests,
        guestFirstName: dto.guestFirstName,
        guestLastName:  dto.guestLastName,
        guestEmail:     dto.guestEmail,
        guestPhone:     dto.guestPhone,
        specialRequests: dto.specialRequests,
        status:         BookingStatus.HELD,
        subtotalNgn:    pricing.subtotalNgn,
        serviceFeeNgn:  pricing.serviceFeeNgn,
        totalNgn:       pricing.totalNgn,
        heldUntil:      new Date(Date.now() + 10 * 60 * 1000),
      },
      include: bookingInclude,
    });

    this.notificationsGateway.notifyNewOrder(dto.hotelId, {
      bookingId: booking.id,
      reference: booking.reference,
      guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
      guestPhone: booking.guestPhone,
      guestEmail: booking.guestEmail,
      roomType:   resource.name,
      checkIn:    checkInDate.toISOString().slice(0, 10),
      checkOut:   checkOutDate.toISOString().slice(0, 10),
      nights, guests: booking.guests, specialRequests: booking.specialRequests,
      totalPrice: booking.totalNgn, status: booking.status,
    });

    this.logger.log(`[BOOKING] ${booking.reference} created for hotel ${dto.hotelId}`);
    return booking;
  }

  async confirmBooking(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (![BookingStatus.HELD, BookingStatus.PAYMENT_PENDING].includes(booking.status as typeof BookingStatus.HELD)) {
      throw new BadRequestException('Booking cannot be confirmed in its current status');
    }
    if (booking.heldUntil && booking.heldUntil < new Date()) {
      await this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.PENDING } });
      throw new BadRequestException('Booking hold has expired. Please try again.');
    }

    const confirmed = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      include: bookingInclude,
    });

    this.notificationsGateway.notifyBookingConfirmed(confirmed.hotelId, {
      bookingId: confirmed.id, reference: confirmed.reference,
      guestName: `${confirmed.guestFirstName} ${confirmed.guestLastName}`,
      guestPhone: confirmed.guestPhone,
      roomType: confirmed.resource?.name ?? '',
      checkIn:  confirmed.checkIn.toISOString().slice(0, 10),
      checkOut: confirmed.checkOut.toISOString().slice(0, 10),
      status: 'CONFIRMED',
    });

    return confirmed;
  }

  async cancelBooking(bookingId: string, userId: string, dto: CancelBookingDto): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId }, include: { hotel: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId && booking.hotel.ownerId !== userId) throw new ForbiddenException();

    const cancellable = [BookingStatus.PENDING, BookingStatus.HELD, BookingStatus.PAYMENT_PENDING, BookingStatus.CONFIRMED];
    if (!cancellable.includes(booking.status as typeof BookingStatus.PENDING)) {
      throw new BadRequestException('Booking cannot be cancelled in its current status');
    }

    const cancelled = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: dto.reason ?? null },
    });

    this.notificationsGateway.notifyBookingCancelled(booking.hotelId, {
      bookingId: cancelled.id, reference: cancelled.reference,
      guestName: `${cancelled.guestFirstName} ${cancelled.guestLastName}`,
      reason: dto.reason || 'No reason provided',
      cancelledAt: cancelled.cancelledAt?.toISOString(),
    });

    return cancelled;
  }

  async updateBookingStatus(bookingId: string, staffUserId: string, dto: UpdateBookingStatusDto): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId }, include: { hotel: { include: { staff: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isOwner = booking.hotel.ownerId === staffUserId;
    const isStaff = booking.hotel.staff.some(s => s.userId === staffUserId && s.isActive);
    if (!isOwner && !isStaff) throw new ForbiddenException('You do not have access to this booking');

    const TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
      [BookingStatus.CONFIRMED]:  [BookingStatus.CHECKED_IN, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
    };
    const allowed = TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(dto.status)) throw new BadRequestException('Invalid status transition');

    const updateData: Prisma.BookingUpdateInput = { status: dto.status };
    if (dto.status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.reason ?? null;
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId }, data: updateData, include: bookingInclude,
    });

    this.notificationsGateway.notifyOrderStatusUpdate(booking.hotelId, {
      bookingId: updated.id, reference: updated.reference,
      guestName: `${updated.guestFirstName} ${updated.guestLastName}`,
      previousStatus: booking.status, newStatus: updated.status,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  async getMyBookings(userId: string, query: BookingQueryDto): Promise<{ bookings: (Booking & { hasReview: boolean })[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.BookingWhereInput = { userId, ...(query.status && { status: query.status }) };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          hotel: { select: { name: true, city: true, state: true } },
          resource: { select: { name: true, bookingUnit: true, images: { where: { isPrimary: true }, take: 1 } } },
          review: { select: { id: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings: bookings.map(b => ({ ...b, hasReview: b.review !== null })), total };
  }

  async getHotelBookings(hotelId: string, ownerId: string, query: BookingQueryDto): Promise<{ bookings: Booking[]; total: number }> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId }, include: { staff: true } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const isOwner = hotel.ownerId === ownerId;
    const isStaff = hotel.staff.some(s => s.userId === ownerId && s.isActive);
    if (!isOwner && !isStaff) throw new ForbiddenException('You do not have access to this hotel');

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.BookingWhereInput = {
      hotelId,
      ...(query.status && { status: query.status }),
      ...(query.checkIn  && { checkIn:  { gte: new Date(query.checkIn  + 'T00:00:00Z') } }),
      ...(query.checkOut && { checkOut: { lte: new Date(query.checkOut + 'T00:00:00Z') } }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { resource: { select: { name: true, bookingUnit: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async getBookingById(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: true, resource: { include: { images: true, category: { include: { resourceType: true } } } }, payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId && booking.hotel.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }
    return booking;
  }

  async releaseExpiredHolds(): Promise<number> {
    const expired = await this.prisma.booking.findMany({
      where: { status: BookingStatus.HELD, heldUntil: { lt: new Date() } },
    });
    for (const booking of expired) {
      try {
        await this.prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.PENDING } });
      } catch (err) {
        this.logger.error(`Failed to release expired hold ${booking.id}`, err instanceof Error ? err.stack : String(err));
      }
    }
    return expired.length;
  }

  async createWalkIn(hotelId: string, staffUserId: string, dto: CreateWalkInDto): Promise<Booking> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId }, include: { staff: true } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const isOwner = hotel.ownerId === staffUserId;
    const isStaff = hotel.staff.some(s => s.userId === staffUserId && s.isActive);
    if (!isOwner && !isStaff) throw new ForbiddenException('You do not have access to this hotel');

    const resource = await this.prisma.resource.findUnique({ where: { id: dto.resourceId } });
    if (!resource || resource.hotelId !== hotelId) throw new NotFoundException('Resource not found');
    if (!resource.isBookable || resource.lifecycleStatus !== 'ACTIVE') {
      throw new BadRequestException('Resource is not bookable');
    }

    const checkInDate  = new Date(dto.checkIn  + 'T00:00:00Z');
    const checkOutDate = new Date(dto.checkOut + 'T00:00:00Z');
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000);
    if (nights < 1) throw new BadRequestException('Check-out must be after check-in');

    const avail = await this.inventoryService.checkAvailability(dto.resourceId, {
      checkIn: dto.checkIn, checkOut: dto.checkOut, guests: dto.guests,
    });
    if (!avail.available) throw new BadRequestException('No availability for selected dates');

    const pricing = this.calcPricing(0, nights);

    let reference: string;
    do { reference = this.generateReference(); }
    while (await this.prisma.booking.findUnique({ where: { reference } }));

    return this.prisma.booking.create({
      data: {
        reference, userId: staffUserId, hotelId,
        resourceId:     dto.resourceId,
        checkIn:        checkInDate,
        checkOut:       checkOutDate,
        nights,         guests:         dto.guests,
        guestFirstName: dto.guestFirstName,
        guestLastName:  dto.guestLastName,
        guestEmail:     dto.guestEmail,
        guestPhone:     dto.guestPhone,
        specialRequests: dto.specialRequests,
        status:         BookingStatus.CHECKED_IN,
        subtotalNgn:    pricing.subtotalNgn,
        serviceFeeNgn:  pricing.serviceFeeNgn,
        totalNgn:       pricing.totalNgn,
        confirmedAt:    new Date(),
        isWalkIn:       true,
      },
      include: bookingInclude,
    });
  }
}
