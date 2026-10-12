import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BookingStatus, type Review, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreateReviewDto } from './dto/create-review.dto.js';
import { type RespondToReviewDto } from './dto/respond-to-review.dto.js';
import { type ReviewQueryDto } from './dto/review-query.dto.js';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReview(userId: string, dto: CreateReviewDto): Promise<Review> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { hotel: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId) throw new ForbiddenException();

    if (booking.status !== BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('You can only review completed stays');
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });

    if (existing) throw new ConflictException('You have already reviewed this booking');

    return this.prisma.review.create({
      data: {
        ...dto,
        userId,
        hotelId: booking.hotelId,
        isVerified: true,
        isApproved: false,
        isFlagged: false,
      },
      include: { user: true, hotel: true },
    });
  }

  async getHotelReviews(
    hotelId: string,
    query: ReviewQueryDto,
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    const where: Prisma.ReviewWhereInput = {
      hotelId,
      ...(query.approvedOnly && { isApproved: true }),
      ...(query.minRating && { overallRating: { gte: query.minRating } }),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [reviews, total, result] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where: { hotelId },
        _avg: { overallRating: true },
      }),
    ]);

    return { reviews, total, averageRating: result._avg.overallRating ?? 0 };
  }

  async getReviewById(reviewId: string): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        hotel: true,
      },
    });

    if (!review) throw new NotFoundException('Review not found');

    return review;
  }

  async respondToReview(
    reviewId: string,
    hotelOwnerId: string,
    dto: RespondToReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { hotel: true },
    });

    if (!review) throw new NotFoundException('Review not found');

    if (review.hotel.ownerId !== hotelOwnerId) throw new ForbiddenException();

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { hotelResponse: dto.response, respondedAt: new Date() },
    });
  }

  async approveReview(reviewId: string): Promise<Review> {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async flagReview(reviewId: string): Promise<Review> {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isFlagged: true },
    });
  }

  async deleteReview(reviewId: string): Promise<void> {
    await this.prisma.review.delete({ where: { id: reviewId } });
  }

  async getMyReviews(userId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: { userId },
      include: { hotel: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
