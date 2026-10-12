import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { ReviewQueryDto } from './dto/review-query.dto.js';

@ApiTags('reviews')
@Controller('hotels')
export class HotelReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':hotelId/reviews')
  getHotelReviews(
    @Param('hotelId') hotelId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.getHotelReviews(hotelId, query);
  }
}
