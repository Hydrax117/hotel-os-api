import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  VerificationStatus,
  BookingStatus,
  UserRole,
  PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AdminHotelQueryDto } from './dto/admin-hotel-query.dto.js';
import { type AdminUserQueryDto } from './dto/admin-user-query.dto.js';
import { type AdminBookingQueryDto } from './dto/admin-booking-query.dto.js';
import { type AdminApproveHotelDto } from './dto/approve-hotel.dto.js';
import { type PlatformStats, type RevenueStats } from './admin.types.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const [
      totalHotels,
      activeHotels,
      pendingVerifications,
      suspendedHotels,
      totalBookings,
      confirmedBookings,
      paymentAgg,
      totalTravelers,
      totalHotelOwners,
    ] = await Promise.all([
      this.prisma.hotel.count(),
      this.prisma.hotel.count({ where: { isActive: true } }),
      this.prisma.hotel.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      this.prisma.hotel.count({ where: { verificationStatus: VerificationStatus.SUSPENDED } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT],
          },
        },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amountNgn: true, commissionNgn: true },
      }),
      this.prisma.user.count({ where: { role: UserRole.TRAVELER } }),
      this.prisma.user.count({ where: { role: UserRole.HOTEL_OWNER } }),
    ]);

    return {
      totalHotels,
      activeHotels,
      pendingVerifications,
      suspendedHotels,
      totalBookings,
      confirmedBookings,
      gmvNgn: Number(paymentAgg._sum.amountNgn ?? 0),
      platformRevenueNgn: Number(paymentAgg._sum.commissionNgn ?? 0),
      totalTravelers,
      totalHotelOwners,
    };
  }

  async getHotels(query: AdminHotelQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {
      ...(query.status && { verificationStatus: query.status }),
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { city: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [hotels, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { firstName: true, lastName: true, email: true } },
          subscription: true,
          verification: true,
        },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return { hotels, total, page, limit };
  }

  async approveHotel(hotelId: string, adminId: string, dto: AdminApproveHotelDto) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const isApproved = dto.status === VerificationStatus.APPROVED;

    const updated = await this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        verificationStatus: dto.status,
        ...(isApproved && { isActive: true, isPublished: true }),
      },
    });

    await this.prisma.hotelVerification.upsert({
      where: { hotelId },
      create: {
        hotelId,
        status: dto.status,
        notes: dto.notes ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      update: {
        status: dto.status,
        notes: dto.notes ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Hotel ${hotelId} status set to ${dto.status} by admin ${adminId}`);
    return updated;
  }

  async suspendHotel(hotelId: string, adminId: string, reason: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const updated = await this.prisma.hotel.update({
      where: { id: hotelId },
      data: { verificationStatus: VerificationStatus.SUSPENDED, isActive: false },
    });

    await this.prisma.hotelVerification.upsert({
      where: { hotelId },
      create: {
        hotelId,
        status: VerificationStatus.SUSPENDED,
        notes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      update: {
        status: VerificationStatus.SUSPENDED,
        notes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Hotel ${hotelId} suspended by admin ${adminId}. Reason: ${reason}`);
    return updated;
  }

  async getHotelDetail(hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: {
        owner: true,
        staff: { include: { user: true } },
        verification: true,
        subscription: true,
        roomTypes: true,
        images: true,
        amenities: { include: { amenity: true } },
        _count: { select: { reviews: true } },
      },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  async getUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.q && {
        OR: [
          { firstName: { contains: query.q, mode: 'insensitive' } },
          { lastName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async getAllBookings(query: AdminBookingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.fromDate && { createdAt: { gte: new Date(query.fromDate) } }),
      ...(query.toDate && { createdAt: { lte: new Date(query.toDate + 'T23:59:59Z') } }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: { select: { name: true, city: true } },
          user: { select: { firstName: true, lastName: true, email: true } },
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit };
  }

  async getRevenueStats(fromDate: string, toDate: string): Promise<RevenueStats> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: { gte: new Date(fromDate), lte: new Date(toDate + 'T23:59:59Z') },
      },
    });

    const dailyMap = new Map<
      string,
      { gmvNgn: number; commissionNgn: number; bookings: number }
    >();

    for (const p of payments) {
      const date = p.paidAt ? p.paidAt.toISOString().slice(0, 10) : 'unknown';
      const existing = dailyMap.get(date) ?? { gmvNgn: 0, commissionNgn: 0, bookings: 0 };
      dailyMap.set(date, {
        gmvNgn: existing.gmvNgn + Number(p.amountNgn),
        commissionNgn: existing.commissionNgn + Number(p.commissionNgn ?? 0),
        bookings: existing.bookings + 1,
      });
    }

    const dailyRevenue = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const totalGmvNgn = payments.reduce((sum, p) => sum + Number(p.amountNgn), 0);
    const totalCommissionNgn = payments.reduce(
      (sum, p) => sum + Number(p.commissionNgn ?? 0),
      0,
    );
    const bookingCount = payments.length;
    const averageBookingValueNgn = bookingCount > 0 ? totalGmvNgn / bookingCount : 0;

    return {
      fromDate,
      toDate,
      totalGmvNgn,
      totalCommissionNgn,
      bookingCount,
      averageBookingValueNgn,
      dailyRevenue,
    };
  }
}
