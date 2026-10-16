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
import { SubscriptionsService } from './subscriptions.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { ChangePlanDto } from './dto/change-plan.dto.js';
import { InitializePaymentDto } from './dto/initialize-payment.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Static route — must be before /:hotelId wildcards
  @Get('plans')
  getAvailablePlans() {
    return this.subscriptionsService.getAvailablePlans();
  }

  @Post('hotels/:hotelId/initialize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  initializePayment(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.subscriptionsService.initializePayment(hotelId, user.userId, dto.plan);
  }

  @Post('hotels/:hotelId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  verifyPayment(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.subscriptionsService.verifyPayment(hotelId, user.userId, dto.reference);
  }

  @Post('hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  createSubscription(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(hotelId, user.userId, dto);
  }

  @Get('hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  getSubscription(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
  ) {
    return this.subscriptionsService.getSubscription(hotelId, user.userId);
  }

  @Patch('hotels/:hotelId/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  changePlan(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionsService.changePlan(hotelId, user.userId, dto);
  }

  @Delete('hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  cancelSubscription(
    @CurrentUser() user: JwtUser,
    @Param('hotelId') hotelId: string,
  ) {
    return this.subscriptionsService.cancelSubscription(hotelId, user.userId);
  }

  @Post('hotels/:hotelId/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  suspendSubscription(@Param('hotelId') hotelId: string) {
    return this.subscriptionsService.suspendSubscription(hotelId);
  }

  @Post('hotels/:hotelId/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  reactivateSubscription(@Param('hotelId') hotelId: string) {
    return this.subscriptionsService.reactivateSubscription(hotelId);
  }
}
