import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type HotelDocument } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaveDocumentDto } from './dto/save-document.dto.js';

@Injectable()
export class DocumentsService {
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
    this.bucket = this.config.get<string>('SUPABASE_DOCUMENTS_BUCKET', 'hotel-documents')!;
  }

  private async verifyOwnership(hotelId: string, ownerId: string): Promise<void> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');
  }

  async getDocuments(hotelId: string, ownerId: string): Promise<HotelDocument[]> {
    await this.verifyOwnership(hotelId, ownerId);
    return this.prisma.hotelDocument.findMany({ where: { hotelId } });
  }

  async saveDocument(hotelId: string, ownerId: string, dto: SaveDocumentDto): Promise<HotelDocument> {
    await this.verifyOwnership(hotelId, ownerId);

    const existing = await this.prisma.hotelDocument.findUnique({
      where: { hotelId_documentType: { hotelId, documentType: dto.documentType } },
    });

    if (existing) {
      // delete old file from Supabase storage before replacing
      const marker = `/object/public/${this.bucket}/`;
      const markerIndex = existing.url.indexOf(marker);
      if (markerIndex !== -1) {
        const storagePath = existing.url.slice(markerIndex + marker.length);
        await this.supabase.storage.from(this.bucket).remove([storagePath]);
      }
    }

    return this.prisma.hotelDocument.upsert({
      where: { hotelId_documentType: { hotelId, documentType: dto.documentType } },
      create: { hotelId, url: dto.url, documentType: dto.documentType, label: dto.label },
      update: { url: dto.url, label: dto.label },
    });
  }

  async deleteDocument(hotelId: string, documentId: string, ownerId: string): Promise<void> {
    await this.verifyOwnership(hotelId, ownerId);

    const document = await this.prisma.hotelDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);

    // Extract storage path and remove from Supabase
    const marker = `/object/public/${this.bucket}/`;
    const markerIndex = document.url.indexOf(marker);
    if (markerIndex !== -1) {
      const storagePath = document.url.slice(markerIndex + marker.length);
      await this.supabase.storage.from(this.bucket).remove([storagePath]);
    }

    await this.prisma.hotelDocument.delete({ where: { id: documentId } });
  }
}
