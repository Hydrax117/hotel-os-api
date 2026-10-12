import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { type Room, type RoomType, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateRoomTypeDto } from './dto/create-room-type.dto.js';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => InventoryService))
    private inventoryService: InventoryService,
  ) {}

  // ─── Room Types ────────────────────────────────────────────────────────────

  async createRoomType(
    hotelId: string,
    ownerId: string,
    dto: CreateRoomTypeDto,
  ): Promise<RoomType> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);
    if (hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    const roomType = await this.prisma.roomType.create({
      data: {
        hotelId,
        name: dto.name,
        description: dto.description,
        bedType: dto.bedType,
        capacity: dto.capacity,
        sizeSqm: dto.sizeSqm,
        pricePerNight: dto.pricePerNight,
        totalRooms: dto.totalRooms,
      },
      include: { rooms: true },
    });

    // Pre-populate 90 days of inventory
    await this.inventoryService.ensureInventoryExists(roomType.id, 90);

    return roomType;
  }

  async getRoomTypes(hotelId: string): Promise<RoomType[]> {
    return this.prisma.roomType.findMany({
      where: { hotelId },
      include: {
        rooms: true,
        _count: { select: { bookings: true } },
      },
    });
  }

  async getRoomTypeById(roomTypeId: string): Promise<RoomType> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: {
        rooms: true,
        _count: { select: { bookings: true } },
      },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    return roomType;
  }

  async updateRoomType(
    roomTypeId: string,
    ownerId: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomType> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { hotel: true },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    if (roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    return this.prisma.roomType.update({
      where: { id: roomTypeId },
      data: {
        name: dto.name,
        description: dto.description,
        bedType: dto.bedType,
        capacity: dto.capacity,
        sizeSqm: dto.sizeSqm,
        pricePerNight: dto.pricePerNight,
        totalRooms: dto.totalRooms,
      },
      include: { rooms: true },
    });
  }

  async deleteRoomType(roomTypeId: string, ownerId: string): Promise<void> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { hotel: true },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    if (roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    const activeBookings = await this.prisma.booking.count({
      where: {
        roomTypeId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('Cannot delete room type with active bookings');
    }

    await this.prisma.roomType.delete({ where: { id: roomTypeId } });
  }

  // ─── Physical Rooms ────────────────────────────────────────────────────────

  async createRoom(roomTypeId: string, ownerId: string, dto: CreateRoomDto): Promise<Room> {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
      include: { hotel: true },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    if (roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    const existing = await this.prisma.room.findUnique({
      where: { roomTypeId_number: { roomTypeId, number: dto.number } },
    });
    if (existing) {
      throw new ConflictException(
        `Room number '${dto.number}' already exists in this room type`,
      );
    }

    return this.prisma.room.create({
      data: {
        roomTypeId,
        number: dto.number,
        floor: dto.floor,
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async getRooms(roomTypeId: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { roomTypeId },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  async updateRoomStatus(roomId: string, dto: UpdateRoomStatusDto): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException(`Room ${roomId} not found`);

    return this.prisma.room.update({
      where: { id: roomId },
      data: {
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async deleteRoom(roomId: string, ownerId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: { include: { hotel: true } } },
    });
    if (!room) throw new NotFoundException(`Room ${roomId} not found`);
    if (room.roomType.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }
    if (room.status === 'OCCUPIED') {
      throw new BadRequestException('Cannot delete an occupied room');
    }

    await this.prisma.room.delete({ where: { id: roomId } });
  }
}
