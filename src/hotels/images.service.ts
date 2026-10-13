import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type HotelImage } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddImageDto } from './dto/add-image.dto.js';

@Injectable()
export class ImagesService {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'hotel-images')!;
  }

  private async verifyOwnership(hotelId: string, ownerId: string): Promise<void> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');
  }

  async getImages(hotelId: string, ownerId: string): Promise<HotelImage[]> {
    await this.verifyOwnership(hotelId, ownerId);
    return this.prisma.hotelImage.findMany({ where: { hotelId } });
  }

  async addImage(hotelId: string, ownerId: string, dto: AddImageDto): Promise<HotelImage> {
    await this.verifyOwnership(hotelId, ownerId);

    if (dto.isPrimary) {
      await this.prisma.hotelImage.updateMany({
        where: { hotelId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.hotelImage.create({
      data: {
        hotelId,
        url: dto.url,
        caption: dto.caption,
        isPrimary: dto.isPrimary ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async deleteImage(hotelId: string, imageId: string, ownerId: string): Promise<void> {
    await this.verifyOwnership(hotelId, ownerId);

    const image = await this.prisma.hotelImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException(`Image ${imageId} not found`);

    // Extract storage path: everything after /object/public/<bucket>/
    const marker = `/object/public/${this.bucket}/`;
    const markerIndex = image.url.indexOf(marker);
    if (markerIndex !== -1) {
      const storagePath = image.url.slice(markerIndex + marker.length);
      await this.supabase.storage.from(this.bucket).remove([storagePath]);
    }

    await this.prisma.hotelImage.delete({ where: { id: imageId } });
  }

  async setPrimary(hotelId: string, imageId: string, ownerId: string): Promise<HotelImage> {
    await this.verifyOwnership(hotelId, ownerId);

    const image = await this.prisma.hotelImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException(`Image ${imageId} not found`);

    await this.prisma.hotelImage.updateMany({
      where: { hotelId },
      data: { isPrimary: false },
    });

    return this.prisma.hotelImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  }
}
