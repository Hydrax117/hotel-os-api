import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApplicationStatus, type Hotel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreateApplicationDto } from './dto/create-application.dto.js';
import { generateSlug } from '../common/utils/slug.js';

@Injectable()
export class HotelApplicationsService {
  private readonly logger = new Logger(HotelApplicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitApplication(ownerId: string, dto: CreateApplicationDto) {
    // Check if owner already has an approved hotel
    const existingHotel = await this.prisma.hotel.findUnique({ where: { ownerId } });
    if (existingHotel) {
      throw new ConflictException('You already have an approved hotel.');
    }

    // Check if owner already has any application (we allow one application at a time)
    const existingApplication = await this.prisma.hotelApplication.findUnique({
      where: { ownerId },
    });
    if (existingApplication) {
      if (existingApplication.status === ApplicationStatus.PENDING) {
        throw new ConflictException('You already have a pending application under review.');
      }
      if (existingApplication.status === ApplicationStatus.APPROVED) {
        throw new ConflictException('Your application has already been approved.');
      }
      // REJECTED — delete the old one so they can reapply
      await this.prisma.hotelApplication.delete({ where: { ownerId } });
    }

    const application = await this.prisma.hotelApplication.create({
      data: {
        ownerId,
        status: ApplicationStatus.PENDING,
        name: dto.name,
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
        amenityIds: dto.amenityIds ?? [],
        languages: dto.languages ?? [],
        images: dto.images as object[],
        documents: dto.documents as object[],
        rooms: dto.rooms as object[],
      },
    });

    this.logger.log(`Hotel application submitted by owner ${ownerId}: ${application.id}`);
    return application;
  }

  async getMyApplication(ownerId: string) {
    const application = await this.prisma.hotelApplication.findUnique({
      where: { ownerId },
    });
    return application ?? null;
  }

  async getApplicationById(id: string) {
    const application = await this.prisma.hotelApplication.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found.');
    return application;
  }

  async listApplications(status?: string) {
    const where = status ? { status: status as ApplicationStatus } : {};
    return this.prisma.hotelApplication.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async approveApplication(id: string, adminId: string, notes?: string): Promise<Hotel> {
    const application = await this.prisma.hotelApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found.');
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException(
        `Application is already ${application.status.toLowerCase()}. Only PENDING applications can be approved.`,
      );
    }

    // Check if hotel already exists for this owner (race condition guard)
    const existingHotel = await this.prisma.hotel.findUnique({
      where: { ownerId: application.ownerId },
    });
    if (existingHotel) {
      throw new ConflictException('A hotel already exists for this owner.');
    }

    const images = (application.images as Array<{
      url: string;
      caption?: string;
      isPrimary?: boolean;
      sortOrder?: number;
    }>) ?? [];

    const documents = (application.documents as Array<{
      url: string;
      documentType: string;
      label?: string;
    }>) ?? [];

    const rooms = (application.rooms as Array<{
      name: string;
      bedType: string;
      capacity: number;
      pricePerNight: number;
      totalRooms: number;
      description?: string;
      sizeSqm?: number;
      bathroomType?: string;
    }>) ?? [];

    const slug = generateSlug(application.name);

    const [, hotel] = await this.prisma.$transaction([
      // 1. Update application status
      this.prisma.hotelApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          adminNotes: notes ?? null,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      // 2. Create hotel
      this.prisma.hotel.create({
        data: {
          ownerId: application.ownerId,
          name: application.name,
          slug,
          description: application.description,
          address: application.address,
          city: application.city,
          state: application.state,
          country: application.country,
          latitude: application.latitude,
          longitude: application.longitude,
          phone: application.phone,
          email: application.email,
          checkInTime: application.checkInTime,
          checkOutTime: application.checkOutTime,
          verificationStatus: 'APPROVED',
          isActive: true,
          isPublished: false,
          images: {
            create: images.map((img, idx) => ({
              url: img.url,
              caption: img.caption ?? null,
              isPrimary: img.isPrimary ?? idx === 0,
              sortOrder: img.sortOrder ?? idx,
            })),
          },
          documents: {
            create: documents.map(doc => ({
              url: doc.url,
              documentType: doc.documentType,
              label: doc.label ?? null,
            })),
          },
          roomTypes: {
            create: rooms.map(room => ({
              name: room.name,
              bedType: room.bedType,
              capacity: room.capacity,
              pricePerNight: room.pricePerNight,
              totalRooms: room.totalRooms,
              description: room.description ?? null,
              sizeSqm: room.sizeSqm ?? null,
              isActive: true,
            })),
          },
        },
      }),
      // 3. Ensure user role is HOTEL_OWNER
      this.prisma.user.update({
        where: { id: application.ownerId },
        data: { role: 'HOTEL_OWNER' },
      }),
    ]);

    // Create HotelVerification record (not done inline above to avoid circular issues)
    await this.prisma.hotelVerification.create({
      data: {
        hotelId: hotel.id,
        status: 'APPROVED',
        notes: notes ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Application ${id} approved by admin ${adminId}. Hotel created: ${hotel.id}`);
    return hotel;
  }

  async rejectApplication(id: string, adminId: string, notes: string) {
    const application = await this.prisma.hotelApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found.');
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException(
        `Application is already ${application.status.toLowerCase()}. Only PENDING applications can be rejected.`,
      );
    }

    const updated = await this.prisma.hotelApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.REJECTED,
        adminNotes: notes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Application ${id} rejected by admin ${adminId}.`);
    return updated;
  }
}
