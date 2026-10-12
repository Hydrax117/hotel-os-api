import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { type InventoryDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { GetAvailabilityDto } from './dto/get-availability.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { BulkUpdateInventoryDto } from './dto/bulk-update-inventory.dto.js';

export type AvailabilityResult = {
  available: boolean;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: number;
  pricePerNight: number;
  totalPrice: number;
  blockedDates: string[];
};

/** Generate an array of Date objects for each calendar day in [start, end). */
function generateDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current < end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Format a Date to YYYY-MM-DD (UTC). */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RoomsService))
    private roomsService: RoomsService,
  ) {}

  async checkAvailability(
    roomTypeId: string,
    dto: GetAvailabilityDto,
  ): Promise<AvailabilityResult> {
    const checkInDate = new Date(dto.checkIn);
    const checkOutDate = new Date(dto.checkOut);

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);

    const dates = generateDateRange(checkInDate, checkOutDate);
    const nights = dates.length;

    // Load existing inventory days for the range
    const existingDays = await this.prisma.inventoryDay.findMany({
      where: {
        roomTypeId,
        date: { gte: checkInDate, lt: checkOutDate },
      },
    });

    const existingMap = new Map<string, InventoryDay>();
    for (const day of existingDays) {
      existingMap.set(toDateString(day.date), day);
    }

    const blockedDates: string[] = [];
    const availablePerDay: number[] = [];
    let pricePerNight = Number(roomType.pricePerNight);
    let priceFromFirstDay = false;

    for (const date of dates) {
      const key = toDateString(date);
      const day = existingMap.get(key);

      if (day) {
        if (day.isBlocked) {
          blockedDates.push(key);
        }
        const avail = day.totalUnits - day.heldUnits - day.bookedUnits;
        availablePerDay.push(avail);
        if (!priceFromFirstDay && day.priceOverride !== null) {
          pricePerNight = Number(day.priceOverride);
          priceFromFirstDay = true;
        }
      } else {
        // No record — fall back to totalRooms from room type
        availablePerDay.push(roomType.totalRooms);
      }
    }

    const availableRooms = availablePerDay.length > 0 ? Math.min(...availablePerDay) : 0;
    const available = blockedDates.length === 0 && availableRooms > 0;
    const totalPrice = pricePerNight * nights;

    return {
      available,
      roomTypeId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      nights,
      availableRooms: available ? availableRooms : 0,
      pricePerNight,
      totalPrice,
      blockedDates,
    };
  }

  async getCalendar(
    roomTypeId: string,
    fromDate: string,
    toDate: string,
  ): Promise<InventoryDay[]> {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    return this.prisma.inventoryDay.findMany({
      where: {
        roomTypeId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });
  }

  async holdInventory(roomTypeId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const dates = generateDateRange(checkIn, checkOut);

    await this.prisma.$transaction(async (tx) => {
      for (const date of dates) {
        await tx.inventoryDay.update({
          where: { roomTypeId_date: { roomTypeId, date } },
          data: { heldUnits: { increment: 1 } },
        });
      }
    });
  }

  async releaseHold(roomTypeId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const dates = generateDateRange(checkIn, checkOut);

    await this.prisma.$transaction(async (tx) => {
      for (const date of dates) {
        const day = await tx.inventoryDay.findUnique({
          where: { roomTypeId_date: { roomTypeId, date } },
        });
        if (day && day.heldUnits > 0) {
          await tx.inventoryDay.update({
            where: { roomTypeId_date: { roomTypeId, date } },
            data: { heldUnits: { decrement: 1 } },
          });
        }
      }
    });
  }

  async confirmBooking(roomTypeId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const dates = generateDateRange(checkIn, checkOut);

    await this.prisma.$transaction(async (tx) => {
      for (const date of dates) {
        const day = await tx.inventoryDay.findUnique({
          where: { roomTypeId_date: { roomTypeId, date } },
        });
        if (day) {
          await tx.inventoryDay.update({
            where: { roomTypeId_date: { roomTypeId, date } },
            data: {
              heldUnits: day.heldUnits > 0 ? { decrement: 1 } : 0,
              bookedUnits: { increment: 1 },
            },
          });
        }
      }
    });
  }

  async releaseBooking(roomTypeId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const dates = generateDateRange(checkIn, checkOut);

    await this.prisma.$transaction(async (tx) => {
      for (const date of dates) {
        const day = await tx.inventoryDay.findUnique({
          where: { roomTypeId_date: { roomTypeId, date } },
        });
        if (day && day.bookedUnits > 0) {
          await tx.inventoryDay.update({
            where: { roomTypeId_date: { roomTypeId, date } },
            data: { bookedUnits: { decrement: 1 } },
          });
        }
      }
    });
  }

  async updateInventoryDay(
    roomTypeId: string,
    ownerId: string,
    dto: UpdateInventoryDto,
  ): Promise<InventoryDay> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { hotel: true },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    if (roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    const date = new Date(dto.date);

    return this.prisma.inventoryDay.upsert({
      where: { roomTypeId_date: { roomTypeId, date } },
      create: {
        roomTypeId,
        date,
        totalUnits: dto.totalUnits ?? roomType.totalRooms,
        priceOverride: dto.priceOverride ?? null,
        isBlocked: dto.isBlocked ?? false,
      },
      update: {
        ...(dto.totalUnits !== undefined && { totalUnits: dto.totalUnits }),
        ...(dto.priceOverride !== undefined && { priceOverride: dto.priceOverride }),
        ...(dto.isBlocked !== undefined && { isBlocked: dto.isBlocked }),
      },
    });
  }

  async bulkUpdateInventory(
    roomTypeId: string,
    ownerId: string,
    dto: BulkUpdateInventoryDto,
  ): Promise<{ updated: number }> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { hotel: true },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    if (roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    // inclusive of toDate
    const endExclusive = new Date(toDate);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const dates = generateDateRange(fromDate, endExclusive);

    await Promise.all(
      dates.map((date) =>
        this.prisma.inventoryDay.upsert({
          where: { roomTypeId_date: { roomTypeId, date } },
          create: {
            roomTypeId,
            date,
            totalUnits: dto.totalUnits ?? roomType.totalRooms,
            priceOverride: dto.priceOverride ?? null,
            isBlocked: dto.isBlocked ?? false,
          },
          update: {
            ...(dto.totalUnits !== undefined && { totalUnits: dto.totalUnits }),
            ...(dto.priceOverride !== undefined && { priceOverride: dto.priceOverride }),
            ...(dto.isBlocked !== undefined && { isBlocked: dto.isBlocked }),
          },
        }),
      ),
    );

    return { updated: dates.length };
  }

  async ensureInventoryExists(roomTypeId: string, days: number): Promise<void> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + days);

    const dates = generateDateRange(today, endDate);

    await Promise.all(
      dates.map((date) =>
        this.prisma.inventoryDay.upsert({
          where: { roomTypeId_date: { roomTypeId, date } },
          create: {
            roomTypeId,
            date,
            totalUnits: roomType.totalRooms,
          },
          update: {},
        }),
      ),
    );
  }
}
