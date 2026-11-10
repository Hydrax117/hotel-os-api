import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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

  private calculatePricing(
    pricePerNight: number,
    nights: number,
  ): { subtotalNgn: number; serviceFeeNgn: number; totalNgn: number } {
    const subtotal = pricePerNight * nights;
    const serviceFee = Math.round(subtotal * 0.03);
    return { subtotalNgn: subtotal, serviceFeeNgn: serviceFee, totalNgn: subtotal + serviceFee };
  }

  async createBooking(userId: string, dto: CreateBookingDto): Promise<Booking> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } });
    if (!hotel || !hotel.isActive || !hotel.isPublished) {
      throw new NotFoundException('Hotel not found');
    }

    const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
    if (!roomType || roomType.hotelId !== dto.hotelId) {
      throw new NotFoundException('Room type not found');
    }

    const checkInDate = new Date(dto.checkIn + 'T00:00:00Z');
    const checkOutDate = new Date(dto.checkOut + 'T00:00:00Z');
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (nights < 1) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const availability = await this.inventoryService.checkAvailability(dto.roomTypeId, {
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guests: dto.guests,
    });

    if (!availability.available) {
      throw new BadRequestException('No rooms available for selected dates');
    }

    const pricing = this.calculatePricing(availability.pricePerNight, nights);

    let reference: string;
    do {
      reference = this.generateReference();
    } while (await this.prisma.booking.findUnique({ where: { reference } }));

    await this.inventoryService.holdInventory(dto.roomTypeId, checkInDate, checkOutDate);

    try {
      const booking = await this.prisma.booking.create({
        data: {
          reference,
          userId,
          hotelId: dto.hotelId,
          roomTypeId: dto.roomTypeId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          guests: dto.guests,
          guestFirstName: dto.guestFirstName,
          guestLastName: dto.guestLastName,
          guestEmail: dto.guestEmail,
          guestPhone: dto.guestPhone,
          specialRequests: dto.specialRequests,
          status: BookingStatus.HELD,
          subtotalNgn: pricing.subtotalNgn,
          serviceFeeNgn: pricing.serviceFeeNgn,
          totalNgn: pricing.totalNgn,
          heldUntil: new Date(Date.now() + 10 * 60 * 1000),
        },
        include: { hotel: true, roomType: true },
      });

      // 🔔 REAL-TIME NOTIFICATION: Notify restaurant staff of new booking
      this.notificationsGateway.notifyNewOrder(dto.hotelId, {
        bookingId: booking.id,
        reference: booking.reference,
        guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
        guestPhone: booking.guestPhone,
        guestEmail: booking.guestEmail,
        roomType: roomType.name,
        checkIn: booking.checkIn.toISOString().split('T')[0],
        checkOut: booking.checkOut.toISOString().split('T')[0],
        nights: booking.nights,
        guests: booking.guests,
        specialRequests: booking.specialRequests,
        totalPrice: booking.totalNgn,
        status: booking.status,
      });

      this.logger.log(
        `[BOOKING] New booking ${booking.reference} created for hotel ${dto.hotelId} - Notifying staff in real-time`,
      );

      return booking;
    } catch (error) {
      await this.inventoryService.releaseHold(dto.roomTypeId, checkInDate, checkOutDate);
      throw error;
    }
  }

  async confirmBooking(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { roomType: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId) throw new ForbiddenException();

    if (
      booking.status !== BookingStatus.HELD &&
      booking.status !== BookingStatus.PAYMENT_PENDING
    ) {
      throw new BadRequestException('Booking cannot be confirmed in its current status');
    }

    if (booking.heldUntil && booking.heldUntil < new Date()) {
      await this.inventoryService.releaseHold(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.PENDING },
      });
      throw new BadRequestException('Booking hold has expired. Please try again.');
    }

    await this.inventoryService.confirmBooking(
      booking.roomTypeId,
      new Date(booking.checkIn),
      new Date(booking.checkOut),
    );

    const confirmedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      include: { hotel: true, roomType: true },
    });

    // 🔔 REAL-TIME NOTIFICATION: Notify restaurant of booking confirmation
    this.notificationsGateway.notifyBookingConfirmed(confirmedBooking.hotelId, {
      bookingId: confirmedBooking.id,
      reference: confirmedBooking.reference,
      guestName: `${confirmedBooking.guestFirstName} ${confirmedBooking.guestLastName}`,
      guestPhone: confirmedBooking.guestPhone,
      roomType: confirmedBooking.roomType.name,
      checkIn: confirmedBooking.checkIn.toISOString().split('T')[0],
      checkOut: confirmedBooking.checkOut.toISOString().split('T')[0],
      status: 'CONFIRMED',
    });

    this.logger.log(
      `[BOOKING] Booking ${confirmedBooking.reference} confirmed - Real-time notification sent to hotel ${confirmedBooking.hotelId}`,
    );

    return confirmedBooking;
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    dto: CancelBookingDto,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId && booking.hotel.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const cancellableStatuses: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.HELD,
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.CONFIRMED,
    ];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled in its current status');
    }

    if (booking.status === BookingStatus.HELD) {
      await this.inventoryService.releaseHold(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      await this.inventoryService.releaseBooking(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
    }

    const cancelledBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason ?? null,
      },
    });

    // 🔔 REAL-TIME NOTIFICATION: Notify restaurant of booking cancellation
    this.notificationsGateway.notifyBookingCancelled(booking.hotelId, {
      bookingId: cancelledBooking.id,
      reference: cancelledBooking.reference,
      guestName: `${cancelledBooking.guestFirstName} ${cancelledBooking.guestLastName}`,
      reason: dto.reason || 'No reason provided',
      cancelledAt: cancelledBooking.cancelledAt?.toISOString(),
    });

    this.logger.log(
      `[BOOKING] Booking ${cancelledBooking.reference} cancelled - Real-time notification sent to hotel ${booking.hotelId}`,
    );

    return cancelledBooking;
  }

  async updateBookingStatus(
    bookingId: string,
    staffUserId: string,
    dto: UpdateBookingStatusDto,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: { include: { staff: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isOwner = booking.hotel.ownerId === staffUserId;
    const isStaff = booking.hotel.staff.some(
      (s) => s.userId === staffUserId && s.isActive,
    );
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    const VALID_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.NO_SHOW,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
    };

    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException('Invalid status transition');
    }

    if (dto.status === BookingStatus.CANCELLED && booking.status === BookingStatus.CONFIRMED) {
      await this.inventoryService.releaseBooking(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
    }

    if (dto.status === BookingStatus.CHECKED_OUT) {
      await this.inventoryService.releaseBooking(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
    }

    if (dto.status === BookingStatus.NO_SHOW) {
      await this.inventoryService.releaseBooking(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
    }

    const updateData: Prisma.BookingUpdateInput = { status: dto.status };
    if (dto.status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.reason ?? null;
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: { hotel: true, roomType: true },
    });

    // 🔔 REAL-TIME NOTIFICATION: Notify restaurant of status update
    this.notificationsGateway.notifyOrderStatusUpdate(booking.hotelId, {
      bookingId: updatedBooking.id,
      reference: updatedBooking.reference,
      guestName: `${updatedBooking.guestFirstName} ${updatedBooking.guestLastName}`,
      previousStatus: booking.status,
      newStatus: updatedBooking.status,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(
      `[BOOKING] Booking ${updatedBooking.reference} status updated to ${updatedBooking.status} - Real-time notification sent`,
    );

    return updatedBooking;
  }

  async getMyBookings(
    userId: string,
    query: BookingQueryDto,
  ): Promise<{ bookings: (Booking & { hasReview: boolean })[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.BookingWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: { select: { name: true, city: true, state: true } },
          roomType: { select: { name: true, bedType: true } },
          review: { select: { id: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map(b => ({
        ...b,
        hasReview: b.review !== null,
      })),
      total,
    };
  }

  async getHotelBookings(
    hotelId: string,
    ownerId: string,
    query: BookingQueryDto,
  ): Promise<{ bookings: Booking[]; total: number }> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { staff: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const isOwner = hotel.ownerId === ownerId;
    const isStaff = hotel.staff.some((s) => s.userId === ownerId && s.isActive);
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have access to this hotel');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.BookingWhereInput = {
      hotelId,
      ...(query.status && { status: query.status }),
      ...(query.checkIn && { checkIn: { gte: new Date(query.checkIn + 'T00:00:00Z') } }),
      ...(query.checkOut && { checkOut: { lte: new Date(query.checkOut + 'T00:00:00Z') } }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { roomType: { select: { name: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async getBookingById(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: true, roomType: true, payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId && booking.hotel.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return booking;
  }

  async releaseExpiredHolds(): Promise<number> {
    const expiredBookings = await this.prisma.booking.findMany({
      where: { status: BookingStatus.HELD, heldUntil: { lt: new Date() } },
    });

    for (const booking of expiredBookings) {
      try {
        await this.inventoryService.releaseHold(
          booking.roomTypeId,
          new Date(booking.checkIn),
          new Date(booking.checkOut),
        );
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.PENDING,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to release expired hold for booking ${booking.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return expiredBookings.length;
  }

  /**
   * Walk-in booking: created by hotel staff for a guest who shows up in person.
   * Skips payment — booking is immediately CHECKED_IN.
   * Staff user must be the hotel owner or active staff member.
   */
  async createWalkIn(
    hotelId: string,
    staffUserId: string,
    dto: CreateWalkInDto,
  ): Promise<Booking> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { staff: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const isOwner = hotel.ownerId === staffUserId;
    const isStaff = hotel.staff.some((s) => s.userId === staffUserId && s.isActive);
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have access to this hotel');
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: dto.roomTypeId },
    });
    if (!roomType || roomType.hotelId !== hotelId) {
      throw new NotFoundException('Room type not found');
    }

    const checkInDate  = new Date(dto.checkIn  + 'T00:00:00Z');
    const checkOutDate = new Date(dto.checkOut + 'T00:00:00Z');
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (nights < 1) throw new BadRequestException('Check-out must be after check-in');

    const availability = await this.inventoryService.checkAvailability(dto.roomTypeId, {
      checkIn:  dto.checkIn,
      checkOut: dto.checkOut,
      guests:   dto.guests,
    });
    if (!availability.available) {
      throw new BadRequestException('No rooms available for the selected dates');
    }

    const pricing = this.calculatePricing(availability.pricePerNight, nights);

    let reference: string;
    do {
      reference = this.generateReference();
    } while (await this.prisma.booking.findUnique({ where: { reference } }));

    // Confirm inventory immediately (no hold needed for walk-ins)
    await this.inventoryService.holdInventory(dto.roomTypeId, checkInDate, checkOutDate);
    await this.inventoryService.confirmBooking(dto.roomTypeId, checkInDate, checkOutDate);

    const booking = await this.prisma.booking.create({
      data: {
        reference,
        userId:         staffUserId,   // staff member acts on behalf of the guest
        hotelId,
        roomTypeId:     dto.roomTypeId,
        checkIn:        checkInDate,
        checkOut:       checkOutDate,
        nights,
        guests:         dto.guests,
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
      include: { hotel: true, roomType: true },
    });

    return booking;
  }

  /**
   * Check availability for a stay extension.
   * Returns pricing for the extra nights if available.
   */
  async checkExtensionAvailability(
    bookingId: string,
    userId: string,
    newCheckOut: string,
  ): Promise<{ available: boolean; extraNights: number; extraAmountNgn: number; pricePerNight: number }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { roomType: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('You can only extend an active (checked-in) stay');
    }

    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00Z');
    const currentCheckOut = new Date(booking.checkOut);

    if (newCheckOutDate <= currentCheckOut) {
      throw new BadRequestException('New check-out must be after the current check-out date');
    }

    const extraNights = Math.round(
      (newCheckOutDate.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Check inventory from current checkOut to new checkOut
    const availability = await this.inventoryService.checkAvailability(booking.roomTypeId, {
      checkIn: currentCheckOut.toISOString().slice(0, 10),
      checkOut: newCheckOut,
      guests: booking.guests,
    });

    if (!availability.available) {
      return { available: false, extraNights, extraAmountNgn: 0, pricePerNight: availability.pricePerNight };
    }

    const pricing = this.calculatePricing(availability.pricePerNight, extraNights);

    return {
      available: true,
      extraNights,
      extraAmountNgn: pricing.totalNgn,
      pricePerNight: availability.pricePerNight,
    };
  }

  /**
   * Extend a stay: update checkOut + inventory, create BookingExtension record.
   * Payment is handled separately via payments — this confirms the extension.
   */
  async confirmExtension(
    bookingId: string,
    userId: string,
    newCheckOut: string,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { roomType: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Booking must be CHECKED_IN to extend');
    }

    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00Z');
    const currentCheckOut = new Date(booking.checkOut);

    if (newCheckOutDate <= currentCheckOut) {
      throw new BadRequestException('New check-out must be after the current check-out date');
    }

    const extraNights = Math.round(
      (newCheckOutDate.getTime() - currentCheckOut.getTime()) / (1000 * 60 * 60 * 24),
    );

    const availability = await this.inventoryService.checkAvailability(booking.roomTypeId, {
      checkIn: currentCheckOut.toISOString().slice(0, 10),
      checkOut: newCheckOut,
      guests: booking.guests,
    });
    if (!availability.available) {
      throw new BadRequestException('No availability for the requested extension dates');
    }

    const pricing = this.calculatePricing(availability.pricePerNight, extraNights);

    // Hold + confirm inventory for the extra nights
    await this.inventoryService.holdInventory(booking.roomTypeId, currentCheckOut, newCheckOutDate);
    await this.inventoryService.confirmBooking(booking.roomTypeId, currentCheckOut, newCheckOutDate);

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkOut: newCheckOutDate,
        nights: booking.nights + extraNights,
        subtotalNgn: Number(booking.subtotalNgn) + pricing.subtotalNgn,
        serviceFeeNgn: Number(booking.serviceFeeNgn) + pricing.serviceFeeNgn,
        totalNgn: Number(booking.totalNgn) + pricing.totalNgn,
      },
      include: { hotel: true, roomType: true },
    });

    // Record the extension
    await this.prisma.bookingExtension.create({
      data: {
        bookingId,
        prevCheckOut: currentCheckOut,
        newCheckOut: newCheckOutDate,
        extraNights,
        extraAmountNgn: pricing.totalNgn,
      },
    });

    return updatedBooking;
  }
}
