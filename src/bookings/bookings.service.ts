import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, type Booking, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { type CreateBookingDto } from './dto/create-booking.dto.js';
import { type CancelBookingDto } from './dto/cancel-booking.dto.js';
import { type UpdateBookingStatusDto } from './dto/update-booking-status.dto.js';
import { type BookingQueryDto } from './dto/booking-query.dto.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
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

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      include: { hotel: true, roomType: true },
    });
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

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason ?? null,
      },
    });
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

    const updateData: Prisma.BookingUpdateInput = { status: dto.status };
    if (dto.status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.reason ?? null;
    }

    return this.prisma.booking.update({ where: { id: bookingId }, data: updateData });
  }

  async getMyBookings(
    userId: string,
    query: BookingQueryDto,
  ): Promise<{ bookings: Booking[]; total: number }> {
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
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async getHotelBookings(
    hotelId: string,
    ownerId: string,
    query: BookingQueryDto,
  ): Promise<{ bookings: Booking[]; total: number }> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');

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
      await this.inventoryService.releaseHold(
        booking.roomTypeId,
        new Date(booking.checkIn),
        new Date(booking.checkOut),
      );
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Hold expired',
        },
      });
    }

    return expiredBookings.length;
  }
}
