import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PaymentsService } from './payments.service.js';
import { InitializePaymentDto } from './dto/initialize-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Webhook — no auth guard; must come before any param routes
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Finding 10: pass the raw Buffer to avoid UTF-8 encoding assumptions
    const payload = req.rawBody ?? Buffer.alloc(0);
    return this.paymentsService.handleWebhook(payload, signature);
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initializePayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentsService.initializePayment(user.userId, dto);
  }

  // Finding 1: pass user.userId so verifyAndConfirmPayment can enforce ownership
  @Get('verify/:reference')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Param('reference') reference: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentsService.verifyAndConfirmPayment(reference, user.userId);
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  async getPaymentByBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentsService.getPaymentByBooking(bookingId, user.userId);
  }

  @Get('hotel/:hotelId')
  @UseGuards(JwtAuthGuard)
  async getHotelPayments(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.paymentsService.getHotelPayments(hotelId, user.userId);
  }

  // Finding 4: refund is SUPER_ADMIN-only
  @Post(':paymentId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(paymentId, user.userId, dto);
  }
}
