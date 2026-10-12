import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  BookingStatus,
  RefundStatus,
  type Payment,
  type Refund,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { PaystackService } from './paystack.service.js';
import { type InitializePaymentDto } from './dto/initialize-payment.dto.js';
import { type RefundPaymentDto } from './dto/refund-payment.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly commissionRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
  ) {
    this.commissionRate =
      this.configService.get<number>('PLATFORM_COMMISSION_RATE') ?? 0.1;
  }

  async initializePayment(
    userId: string,
    dto: InitializePaymentDto,
  ): Promise<{ paymentUrl: string; reference: string; bookingReference: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { hotel: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }
    if (
      booking.status !== BookingStatus.HELD &&
      booking.status !== BookingStatus.PAYMENT_PENDING
    ) {
      throw new BadRequestException(
        'Booking must be in HELD or PAYMENT_PENDING status to initialize payment',
      );
    }

    const existingSuccess = await this.prisma.payment.findFirst({
      where: { bookingId: dto.bookingId, status: PaymentStatus.SUCCESS },
    });
    if (existingSuccess) {
      throw new ConflictException('A successful payment already exists for this booking');
    }

    const reference = `HOS-PAY-${booking.reference}-${Date.now()}`;

    const totalNgn = Number(booking.totalNgn);
    const commission = Math.round(totalNgn * this.commissionRate);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        reference,
        amountNgn: totalNgn,
        commissionNgn: commission,
        netNgn: totalNgn - commission,
        status: PaymentStatus.PENDING,
      },
    });

    let result: Awaited<ReturnType<PaystackService['initializeTransaction']>>;
    try {
      result = await this.paystackService.initializeTransaction({
        email: dto.email,
        amount: totalNgn * 100,
        reference,
        callbackUrl: dto.callbackUrl,
        metadata: { bookingId: dto.bookingId, userId },
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw error;
    }

    await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { status: BookingStatus.PAYMENT_PENDING },
    });

    return {
      paymentUrl: result.authorizationUrl,
      reference,
      bookingReference: booking.reference,
    };
  }

  /**
   * Verifies payment with Paystack and confirms or cancels the booking accordingly.
   * Finding 1: userId is now required so ownership can be enforced.
   * Pass the booking owner's userId (from payment.booking.userId) when calling
   * from the webhook path; pass the request user's userId from the controller.
   */
  async verifyAndConfirmPayment(reference: string, userId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: { booking: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Ownership check — prevents any authenticated user from triggering another
    // user's booking state transition via the verify endpoint.
    if (payment.booking.userId !== userId) {
      throw new ForbiddenException('You do not own this payment');
    }

    // Idempotent — already confirmed
    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    const result = await this.paystackService.verifyTransaction(reference);

    if (result.status === 'success') {
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
          method: result.channel,
          providerRef: result.reference,
        },
      });
      await this.bookingsService.confirmBooking(
        payment.booking.id,
        payment.booking.userId,
      );
      return updated;
    }

    if (result.status === 'failed' || result.status === 'abandoned') {
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureReason: result.status,
        },
      });
      await this.bookingsService.cancelBooking(
        payment.booking.id,
        payment.booking.userId,
        { reason: 'Payment failed' },
      );
      return updated;
    }

    return payment;
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    // Finding 10: pass Buffer directly — no encoding dependency
    const valid = this.paystackService.verifyWebhookSignature(payload, signature);
    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = JSON.parse(payload.toString('utf-8')) as {
      event: string;
      data: { reference: string };
    };

    if (event.event !== 'charge.success' && event.event !== 'charge.failed') {
      return;
    }

    const reference = event.data.reference;

    // Idempotency check
    const existing = await this.prisma.payment.findFirst({
      where: {
        reference,
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED] },
      },
    });
    if (existing) {
      return;
    }

    // Load payment to get the booking owner — required by verifyAndConfirmPayment
    const payment = await this.prisma.payment.findFirst({
      where: { reference },
      include: { booking: true },
    });
    if (!payment) {
      this.logger.warn(`Webhook received for unknown payment reference: ${reference}`);
      return;
    }

    // Use the booking owner's userId so ownership check always passes for webhooks
    await this.verifyAndConfirmPayment(reference, payment.booking.userId);
  }

  async refundPayment(
    paymentId: string,
    userId: string,
    dto: RefundPaymentDto,
  ): Promise<Refund> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    // Finding 4 is access-controlled at the controller level (SUPER_ADMIN role);
    // the service-level check ensures the payment exists and status is valid.
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }
    if (
      payment.booking.status !== BookingStatus.CONFIRMED &&
      payment.booking.status !== BookingStatus.CHECKED_OUT
    ) {
      throw new BadRequestException(
        'Booking must be CONFIRMED or CHECKED_OUT to issue a refund',
      );
    }

    const amountNgn = dto.amountNgn ?? Number(payment.amountNgn);

    // Finding 7: guard against over-refund before touching any external system
    if (amountNgn > Number(payment.amountNgn)) {
      throw new BadRequestException(
        'Refund amount cannot exceed the original payment amount',
      );
    }

    // Finding 6: create local Refund record first, then call Paystack, then update status.
    // This way, if the DB update after Paystack succeeds fails, the record shows PENDING
    // (submitted but not confirmed) rather than appearing as if it was never submitted.
    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        amountNgn,
        reason: dto.reason,
        status: RefundStatus.PENDING,
      },
    });

    // Finding 2: update Payment.status to REFUNDED before calling Paystack,
    // so downstream guards that check payment.status !== SUCCESS work correctly.
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });

    await this.paystackService.createRefund(payment.reference, amountNgn * 100);

    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: { status: RefundStatus.PROCESSING },
    });

    // Finding 3: cancel the booking after a successful refund submission
    await this.bookingsService.cancelBooking(
      payment.booking.id,
      payment.booking.userId,
      { reason: dto.reason },
    );

    return updated;
  }

  async getPaymentByBooking(bookingId: string, userId: string): Promise<Payment | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }
    return this.prisma.payment.findFirst({ where: { bookingId } });
  }

  async getHotelPayments(hotelId: string, ownerId: string): Promise<Payment[]> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }
    if (hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    return this.prisma.payment.findMany({
      where: {
        booking: { hotelId },
      },
      include: {
        booking: {
          select: {
            reference: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
