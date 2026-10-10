import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { type Hotel, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHotelDto } from './dto/create-hotel.dto.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';
import { HotelQueryDto } from './dto/hotel-query.dto.js';
import { ApproveHotelDto } from './dto/approve-hotel.dto.js';
import { generateSlug } from '../common/utils/slug.js';

const hotelInclude = {
  verification: true,
  amenities: { include: { amenity: true } },
  images: true,
} satisfies Prisma.HotelInclude;

const hotelPublicInclude = {
  amenities: { include: { amenity: true } },
  images: { where: { isPrimary: true } },
} satisfies Prisma.HotelInclude;

@Injectable()
export class HotelsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: HotelQueryDto): Promise<{
    hotels: Hotel[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {};

    // Admin status filter — if provided, use it; otherwise only show approved+published
    if (query.status) {
      where.verificationStatus = query.status;
    } else {
      where.verificationStatus = 'APPROVED';
      where.isPublished = true;
    }

    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = { contains: query.state, mode: 'insensitive' };
    }
    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }

    const [hotels, total] = await this.prisma.$transaction([
      this.prisma.hotel.findMany({
        where,
        include: hotelPublicInclude,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return { hotels, total, page, limit };
  }

  async findById(id: string): Promise<Hotel> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: hotelInclude,
    });
    if (!hotel) throw new NotFoundException(`Hotel ${id} not found`);
    return hotel;
  }

  async findBySlug(slug: string): Promise<Hotel> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { slug },
      include: hotelInclude,
    });
    if (!hotel) throw new NotFoundException(`Hotel with slug '${slug}' not found`);
    return hotel;
  }

  async create(ownerId: string, dto: CreateHotelDto): Promise<Hotel> {
    const existing = await this.prisma.hotel.findUnique({ where: { ownerId } });
    if (existing) {
      throw new ConflictException('You already have a registered hotel');
    }

    const slug = generateSlug(dto.name);

    const hotel = await this.prisma.hotel.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        description: dto.description,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'Nigeria',
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        checkInTime: dto.checkInTime ?? '14:00',
        checkOutTime: dto.checkOutTime ?? '12:00',
        verificationStatus: 'PENDING',
        isActive: false,
        isPublished: false,
        verification: {
          create: {
            status: 'PENDING',
          },
        },
        amenities: dto.amenityIds?.length
          ? {
              create: dto.amenityIds.map((amenityId) => ({ amenityId })),
            }
          : undefined,
      },
      include: hotelInclude,
    });

    return hotel;
  }

  async update(hotelId: string, ownerId: string, dto: UpdateHotelDto): Promise<Hotel> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');

    return this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        email: dto.email,
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
      },
      include: hotelInclude,
    });
  }

  async getMyHotel(ownerId: string): Promise<Hotel> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { ownerId },
      include: hotelInclude,
    });
    if (!hotel) throw new NotFoundException('No hotel found for this owner');
    return hotel;
  }

  async updateVerificationStatus(
    hotelId: string,
    dto: ApproveHotelDto,
    adminId: string,
  ): Promise<Hotel> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);

    const isApproved = dto.status === 'APPROVED';

    await this.prisma.hotelVerification.update({
      where: { hotelId },
      data: {
        status: dto.status,
        notes: dto.notes,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });

    return this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        verificationStatus: dto.status,
        isActive: isApproved,
        isPublished: isApproved,
      },
      include: hotelInclude,
    });
  }

  async getPendingVerifications(): Promise<Hotel[]> {
    return this.prisma.hotel.findMany({
      where: { verificationStatus: 'PENDING' },
      include: hotelInclude,
      orderBy: { createdAt: 'asc' },
    });
  }
}
