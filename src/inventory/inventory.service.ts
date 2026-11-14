/**
 * InventoryService — resource-based availability engine.
 *
 * Replaces the old InventoryDay / RoomType model.
 * Availability is determined by checking for existing active Bookings
 * against a Resource over a date range (half-open interval [checkIn, checkOut)).
 *
 * A resource is available if:
 *   1. lifecycleStatus === ACTIVE
 *   2. isBookable === true
 *   3. No confirmed/held booking overlaps the requested interval
 *   4. No availability block covers any day in the interval
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type AvailabilityResult = {
  available: boolean;
  resourceId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  availableCount: number;   // 1 if available, 0 if not (single exclusive resource)
  pricePerNight: number;    // 0 until rate plans are wired
  totalPrice: number;
  blockedDates: string[];
};

/** Format a Date to YYYY-MM-DD (UTC). */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Generate YYYY-MM-DD strings for each day in [start, end). */
function dateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur < end) {
    dates.push(toDateStr(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async checkAvailability(
    resourceId: string,
    opts: { checkIn: string; checkOut: string; guests?: number },
  ): Promise<AvailabilityResult> {
    const checkInDate  = new Date(opts.checkIn  + 'T00:00:00Z');
    const checkOutDate = new Date(opts.checkOut + 'T00:00:00Z');
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) throw new NotFoundException(`Resource ${resourceId} not found`);

    // Not bookable at all
    if (!resource.isBookable || resource.lifecycleStatus !== 'ACTIVE') {
      return {
        available: false,
        resourceId,
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        nights,
        availableCount: 0,
        pricePerNight: 0,
        totalPrice: 0,
        blockedDates: [],
      };
    }

    // Capacity check
    if (opts.guests !== undefined && resource.capacity !== null) {
      if (opts.guests > resource.capacity) {
        return {
          available: false,
          resourceId,
          checkIn: opts.checkIn,
          checkOut: opts.checkOut,
          nights,
          availableCount: 0,
          pricePerNight: 0,
          totalPrice: 0,
          blockedDates: [],
        };
      }
    }

    // Check overlapping active bookings (HELD or CONFIRMED or CHECKED_IN)
    const conflictingBooking = await this.prisma.booking.findFirst({
      where: {
        resourceId,
        status: {
          in: [BookingStatus.HELD, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
        },
        // Overlap: booking.checkIn < checkOut AND booking.checkOut > checkIn
        checkIn:  { lt: checkOutDate },
        checkOut: { gt: checkInDate  },
      },
      select: { id: true },
    });

    // Check availability blocks
    const blocks = await this.prisma.availabilityBlock.findMany({
      where: {
        resourceId,
        startAt: { lt: checkOutDate },
        endAt:   { gt: checkInDate  },
      },
      select: { startAt: true, endAt: true },
    });

    const blockedDates: string[] = [];
    for (const block of blocks) {
      const days = dateRange(block.startAt, block.endAt);
      for (const d of days) {
        if (!blockedDates.includes(d)) blockedDates.push(d);
      }
    }

    const available = !conflictingBooking && blockedDates.length === 0;

    return {
      available,
      resourceId,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      nights,
      availableCount: available ? 1 : 0,
      pricePerNight: 0,  // Rate plans not yet wired
      totalPrice: 0,
      blockedDates,
    };
  }

  /**
   * Returns availability calendar for a resource — 30 days starting today.
   * Each entry: { date, available }.
   */
  async getCalendar(
    resourceId: string,
    fromDate: string,
    toDate: string,
  ): Promise<{ date: string; available: boolean }[]> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) throw new NotFoundException(`Resource ${resourceId} not found`);

    const from = new Date(fromDate + 'T00:00:00Z');
    const to   = new Date(toDate   + 'T00:00:00Z');
    const days = dateRange(from, to);

    // Load all conflicting bookings in the whole range at once
    const bookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        checkIn:  { lt: to   },
        checkOut: { gt: from },
      },
      select: { checkIn: true, checkOut: true },
    });

    // Load blocks in the range
    const blocks = await this.prisma.availabilityBlock.findMany({
      where: {
        resourceId,
        startAt: { lt: to   },
        endAt:   { gt: from },
      },
      select: { startAt: true, endAt: true },
    });

    const occupiedDates = new Set<string>();
    for (const b of bookings) {
      for (const d of dateRange(b.checkIn, b.checkOut)) occupiedDates.add(d);
    }
    for (const bl of blocks) {
      for (const d of dateRange(bl.startAt, bl.endAt)) occupiedDates.add(d);
    }

    return days.map((d) => ({ date: d, available: !occupiedDates.has(d) }));
  }

  /** Mark resource as held by a booking (no-op in new model — booking record is the hold). */
  async holdInventory(_resourceId: string, _checkIn: Date, _checkOut: Date): Promise<void> {
    // No-op: the Booking record itself in HELD status acts as the hold.
    // Keeping this method so callers compiled before the refactor don't break.
  }

  /** Release a hold (no-op — booking status change is the release). */
  async releaseHold(_resourceId: string, _checkIn: Date, _checkOut: Date): Promise<void> {
    // No-op: status change handles this.
  }

  /** Mark a booking as confirmed in inventory (no-op). */
  async confirmBooking(_resourceId: string, _checkIn: Date, _checkOut: Date): Promise<void> {
    // No-op: booking status CONFIRMED is the confirmation.
  }

  /** Release a booking from inventory (no-op — status change handles it). */
  async releaseBooking(_resourceId: string, _checkIn: Date, _checkOut: Date): Promise<void> {
    // No-op.
  }

  /**
   * Create an availability block for a resource.
   * Used by the dashboard to block dates for maintenance/closure.
   */
  async createBlock(
    resourceId: string,
    ownerId: string,
    opts: { startAt: Date; endAt: Date; reason?: string; notes?: string },
  ) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: { hotel: true },
    });
    if (!resource) throw new NotFoundException(`Resource ${resourceId} not found`);
    if (resource.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    return this.prisma.availabilityBlock.create({
      data: {
        propertyId:        resource.hotelId,
        resourceId,
        startAt:           opts.startAt,
        endAt:             opts.endAt,
        reason:            opts.reason ?? 'OTHER',
        notes:             opts.notes,
        createdByUserId:   ownerId,
      },
    });
  }

  async deleteBlock(blockId: string, ownerId: string) {
    const block = await this.prisma.availabilityBlock.findUnique({
      where: { id: blockId },
      include: { resource: { include: { hotel: true } } },
    });
    if (!block) throw new NotFoundException(`Block ${blockId} not found`);
    if (block.resource.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }
    await this.prisma.availabilityBlock.delete({ where: { id: blockId } });
  }

  async listBlocks(resourceId: string) {
    return this.prisma.availabilityBlock.findMany({
      where: { resourceId },
      orderBy: { startAt: 'asc' },
    });
  }
}
