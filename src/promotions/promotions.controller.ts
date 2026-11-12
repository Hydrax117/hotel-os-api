import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PromotionsService } from './promotions.service.js';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/create-promotion.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('promotions')
@Controller('hotels/:hotelId/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
@ApiBearerAuth()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all promotions for a hotel (owner only)' })
  getPromotions(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.promotionsService.getPromotions(hotelId, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a promotion (owner only)' })
  createPromotion(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotionsService.createPromotion(hotelId, user.userId, dto);
  }

  @Patch(':promotionId')
  @ApiOperation({ summary: 'Update a promotion (owner only)' })
  updatePromotion(
    @Param('hotelId') hotelId: string,
    @Param('promotionId') promotionId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(hotelId, promotionId, user.userId, dto);
  }

  @Delete(':promotionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a promotion (owner only)' })
  deletePromotion(
    @Param('hotelId') hotelId: string,
    @Param('promotionId') promotionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.promotionsService.deletePromotion(hotelId, promotionId, user.userId);
  }
}
