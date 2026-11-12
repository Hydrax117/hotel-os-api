import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { type Promotion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreatePromotionDto, type UpdatePromotionDto } from './dto/create-promotion.dto.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnership(hotelId: string, ownerId: string): Promise<void> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');
  }

  async getPromotions(hotelId: string, ownerId: string): Promise<Promotion[]> {
    await this.assertOwnership(hotelId, ownerId);
    return this.prisma.promotion.findMany({
      where: { hotelId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPromotion(
    hotelId: string,
    ownerId: string,
    dto: CreatePromotionDto,
  ): Promise<Promotion> {
    await this.assertOwnership(hotelId, ownerId);

    if (dto.validFrom >= dto.validTo) {
      throw new BadRequestException('validTo must be after validFrom');
    }

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    return this.prisma.promotion.create({
      data: {
        hotelId,
        name: dto.name,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        validFrom: new Date(dto.validFrom + 'T00:00:00Z'),
        validTo: new Date(dto.validTo + 'T00:00:00Z'),
        minNights: dto.minNights ?? 1,
        advanceBookingDays: dto.advanceBookingDays ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updatePromotion(
    hotelId: string,
    promotionId: string,
    ownerId: string,
    dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    await this.assertOwnership(hotelId, ownerId);

    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promotion) throw new NotFoundException('Promotion not found');
    if (promotion.hotelId !== hotelId) throw new ForbiddenException();

    return this.prisma.promotion.update({
      where: { id: promotionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
        ...(dto.validFrom !== undefined && { validFrom: new Date(dto.validFrom + 'T00:00:00Z') }),
        ...(dto.validTo !== undefined && { validTo: new Date(dto.validTo + 'T00:00:00Z') }),
        ...(dto.minNights !== undefined && { minNights: dto.minNights }),
        ...(dto.advanceBookingDays !== undefined && { advanceBookingDays: dto.advanceBookingDays }),
      },
    });
  }

  async deletePromotion(
    hotelId: string,
    promotionId: string,
    ownerId: string,
  ): Promise<void> {
    await this.assertOwnership(hotelId, ownerId);

    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promotion) throw new NotFoundException('Promotion not found');
    if (promotion.hotelId !== hotelId) throw new ForbiddenException();

    await this.prisma.promotion.delete({ where: { id: promotionId } });
  }
}
