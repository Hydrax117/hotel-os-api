import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { RespondToReviewDto } from './dto/respond-to-review.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createReview(@CurrentUser() user: JwtUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.userId, dto);
  }

  // MUST be before /:id to avoid route conflict
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyReviews(@CurrentUser() user: JwtUser) {
    return this.reviewsService.getMyReviews(user.userId);
  }

  @Get(':id')
  getReviewById(@Param('id') id: string) {
    return this.reviewsService.getReviewById(id);
  }

  @Post(':id/respond')
  @UseGuards(JwtAuthGuard)
  respondToReview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return this.reviewsService.respondToReview(id, user.userId, dto);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  approveReview(@Param('id') id: string) {
    return this.reviewsService.approveReview(id);
  }

  @Patch(':id/flag')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  flagReview(@Param('id') id: string) {
    return this.reviewsService.flagReview(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id);
  }
}
