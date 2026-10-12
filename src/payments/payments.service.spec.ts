import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock NestJS decorators and exceptions so Vitest never resolves the full
// @nestjs/common CJS package graph under ESM.
// ---------------------------------------------------------------------------
vi.mock('@nestjs/common', async () => {
  class HttpException extends Error {
    constructor(
      public readonly message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'HttpException';
    }
  }
  class NotFoundException extends HttpException {
    constructor(msg?: string) { super(msg ?? 'Not Found', 404); this.name = 'NotFoundException'; }
  }
  class ForbiddenException extends HttpException {
    constructor(msg?: string) { super(msg ?? 'Forbidden', 403); this.name = 'ForbiddenException'; }
  }
  class BadRequestException extends HttpException {
    constructor(msg?: string) { super(msg ?? 'Bad Request', 400); this.name = 'BadRequestException'; }
  }
  class ConflictException extends HttpException {
    constructor(msg?: string) { super(msg ?? 'Conflict', 409); this.name = 'ConflictException'; }
  }
  class UnauthorizedException extends HttpException {
    constructor(msg?: string) { super(msg ?? 'Unauthorized', 401); this.name = 'UnauthorizedException'; }
  }
  return {
    Injectable: () => () => undefined,
    Logger: class Logger {
      warn = vi.fn();
      error = vi.fn();
      log = vi.fn();
    },
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    UnauthorizedException,
    HttpException,
  };
});

vi.mock('@prisma/client', () => ({
  PaymentStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
  BookingStatus: {
    PENDING: 'PENDING',
    HELD: 'HELD',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    CONFIRMED: 'CONFIRMED',
    CHECKED_IN: 'CHECKED_IN',
    CHECKED_OUT: 'CHECKED_OUT',
    CANCELLED: 'CANCELLED',
    NO_SHOW: 'NO_SHOW',
    FAILED: 'FAILED',
  },
  RefundStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
}));

vi.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaService {
    booking = { findUnique: vi.fn(), update: vi.fn() };
    payment = { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() };
    hotel = { findUnique: vi.fn() };
    refund = { create: vi.fn(), update: vi.fn() };
  },
}));

vi.mock('../bookings/bookings.service.js', () => ({
  BookingsService: class BookingsService {
    confirmBooking = vi.fn();
    cancelBooking = vi.fn();
  },
}));

vi.mock('./paystack.service.js', () => ({
  PaystackService: class PaystackService {
    initializeTransaction = vi.fn();
    verifyTransaction = vi.fn();
    verifyWebhookSignature = vi.fn();
    createRefund = vi.fn();
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { PaystackService } from './paystack.service.js';
import {
  PaymentStatus,
  BookingStatus,
  RefundStatus,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function buildService() {
  const prisma = new PrismaService() as unknown as {
    booking: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    payment: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    hotel: { findUnique: ReturnType<typeof vi.fn> };
    refund: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  const bookings = new BookingsService() as unknown as {
    confirmBooking: ReturnType<typeof vi.fn>;
    cancelBooking: ReturnType<typeof vi.fn>;
  };
  const paystack = new PaystackService() as unknown as {
    initializeTransaction: ReturnType<typeof vi.fn>;
    verifyTransaction: ReturnType<typeof vi.fn>;
    verifyWebhookSignature: ReturnType<typeof vi.fn>;
    createRefund: ReturnType<typeof vi.fn>;
  };
  const config = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'PLATFORM_COMMISSION_RATE') return 0.1;
      return undefined;
    }),
  };

  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    bookings as unknown as BookingsService,
    paystack as unknown as PaystackService,
    config as never,
  );

  return { service, prisma, bookings, paystack, config };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    reference: 'HOS-12345',
    userId: 'user-1',
    hotelId: 'hotel-1',
    status: BookingStatus.HELD,
    totalNgn: { toNumber: () => 10000, valueOf: () => 10000 },
    heldUntil: new Date(Date.now() + 600_000),
    hotel: { id: 'hotel-1' },
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    bookingId: 'booking-1',
    reference: 'HOS-PAY-HOS-12345-1000',
    amountNgn: { toNumber: () => 10000, valueOf: () => 10000 },
    status: PaymentStatus.PENDING,
    booking: makeBooking(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// initializePayment
// ---------------------------------------------------------------------------

describe('PaymentsService — initializePayment', () => {
  it('throws NotFoundException when booking does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(service.initializePayment('user-1', { bookingId: 'x', email: 'a@b.com' }))
      .rejects.toThrow('Booking not found');
  });

  it('throws ForbiddenException when userId does not own the booking', async () => {
    const { service, prisma } = buildService();
    prisma.booking.findUnique.mockResolvedValue(makeBooking({ userId: 'other-user' }));

    await expect(service.initializePayment('user-1', { bookingId: 'booking-1', email: 'a@b.com' }))
      .rejects.toThrow('ForbiddenException');
  });

  it('throws BadRequestException when booking status is not HELD or PAYMENT_PENDING', async () => {
    const { service, prisma } = buildService();
    prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: BookingStatus.CONFIRMED }));

    await expect(service.initializePayment('user-1', { bookingId: 'booking-1', email: 'a@b.com' }))
      .rejects.toThrow('BadRequestException');
  });

  it('throws ConflictException when a SUCCESS payment already exists', async () => {
    const { service, prisma } = buildService();
    prisma.booking.findUnique.mockResolvedValue(makeBooking());
    prisma.payment.findFirst.mockResolvedValue(makePayment({ status: PaymentStatus.SUCCESS }));

    await expect(service.initializePayment('user-1', { bookingId: 'booking-1', email: 'a@b.com' }))
      .rejects.toThrow('ConflictException');
  });

  it('creates Payment and returns paymentUrl on success', async () => {
    const { service, prisma, paystack } = buildService();
    const booking = makeBooking();
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue(makePayment());
    prisma.booking.update.mockResolvedValue({ ...booking, status: BookingStatus.PAYMENT_PENDING });
    paystack.initializeTransaction.mockResolvedValue({
      authorizationUrl: 'https://paystack.com/pay/abc',
      accessCode: 'code-1',
      reference: 'HOS-PAY-HOS-12345-1000',
    });

    const result = await service.initializePayment('user-1', { bookingId: 'booking-1', email: 'user@test.com' });

    expect(prisma.payment.create).toHaveBeenCalledOnce();
    expect(paystack.initializeTransaction).toHaveBeenCalledOnce();
    expect(result.paymentUrl).toBe('https://paystack.com/pay/abc');
    expect(result.bookingReference).toBe('HOS-12345');
  });

  it('marks Payment as FAILED if Paystack initialization throws', async () => {
    const { service, prisma, paystack } = buildService();
    const payment = makePayment();
    prisma.booking.findUnique.mockResolvedValue(makeBooking());
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue(payment);
    paystack.initializeTransaction.mockRejectedValue(new Error('Gateway error'));
    prisma.payment.update.mockResolvedValue({ ...payment, status: PaymentStatus.FAILED });

    await expect(service.initializePayment('user-1', { bookingId: 'booking-1', email: 'user@test.com' }))
      .rejects.toThrow();

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PaymentStatus.FAILED } }),
    );
  });
});

// ---------------------------------------------------------------------------
// verifyAndConfirmPayment
// ---------------------------------------------------------------------------

describe('PaymentsService — verifyAndConfirmPayment', () => {
  it('throws NotFoundException when payment is not found', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.verifyAndConfirmPayment('ref-x', 'user-1'))
      .rejects.toThrow('Payment not found');
  });

  it('throws ForbiddenException when userId does not own the booking', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(makePayment({ booking: makeBooking({ userId: 'other-user' }) }));

    await expect(service.verifyAndConfirmPayment('ref-x', 'user-1'))
      .rejects.toThrow('ForbiddenException');
  });

  it('returns payment immediately when status is already SUCCESS (idempotent)', async () => {
    const { service, prisma, paystack } = buildService();
    const payment = makePayment({ status: PaymentStatus.SUCCESS });
    prisma.payment.findUnique.mockResolvedValue(payment);

    const result = await service.verifyAndConfirmPayment(payment.reference, 'user-1');

    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(result.status).toBe(PaymentStatus.SUCCESS);
  });

  it('calls confirmBooking and updates payment on Paystack success', async () => {
    const { service, prisma, bookings, paystack } = buildService();
    const payment = makePayment();
    const updatedPayment = { ...payment, status: PaymentStatus.SUCCESS };
    prisma.payment.findUnique.mockResolvedValue(payment);
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', channel: 'card', reference: payment.reference });
    prisma.payment.update.mockResolvedValue(updatedPayment);
    bookings.confirmBooking.mockResolvedValue({});

    const result = await service.verifyAndConfirmPayment(payment.reference, 'user-1');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.SUCCESS }) }),
    );
    expect(bookings.confirmBooking).toHaveBeenCalledWith('booking-1', 'user-1');
    expect(result.status).toBe(PaymentStatus.SUCCESS);
  });

  it('calls cancelBooking and updates payment on Paystack failure', async () => {
    const { service, prisma, bookings, paystack } = buildService();
    const payment = makePayment();
    const updatedPayment = { ...payment, status: PaymentStatus.FAILED };
    prisma.payment.findUnique.mockResolvedValue(payment);
    paystack.verifyTransaction.mockResolvedValue({ status: 'failed', channel: 'card', reference: payment.reference });
    prisma.payment.update.mockResolvedValue(updatedPayment);
    bookings.cancelBooking.mockResolvedValue({});

    const result = await service.verifyAndConfirmPayment(payment.reference, 'user-1');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.FAILED }) }),
    );
    expect(bookings.cancelBooking).toHaveBeenCalledWith('booking-1', 'user-1', { reason: 'Payment failed' });
    expect(result.status).toBe(PaymentStatus.FAILED);
  });
});

// ---------------------------------------------------------------------------
// handleWebhook
// ---------------------------------------------------------------------------

describe('PaymentsService — handleWebhook', () => {
  it('throws UnauthorizedException on invalid signature', async () => {
    const { service, paystack } = buildService();
    paystack.verifyWebhookSignature.mockReturnValue(false);

    const payload = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));

    await expect(service.handleWebhook(payload, 'bad-sig'))
      .rejects.toThrow('Invalid webhook signature');
  });

  it('returns early for unrecognised event types', async () => {
    const { service, prisma, paystack } = buildService();
    paystack.verifyWebhookSignature.mockReturnValue(true);
    const payload = Buffer.from(JSON.stringify({ event: 'transfer.success', data: { reference: 'ref-1' } }));

    await service.handleWebhook(payload, 'valid-sig');

    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('returns early when payment is already in terminal status (idempotent)', async () => {
    const { service, prisma, paystack } = buildService();
    paystack.verifyWebhookSignature.mockReturnValue(true);
    // First findFirst call (idempotency check) returns a terminal payment
    prisma.payment.findFirst.mockResolvedValue(makePayment({ status: PaymentStatus.SUCCESS }));

    const payload = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));

    await service.handleWebhook(payload, 'valid-sig');

    // findFirst called once for idempotency check, no payment.findUnique for verify
    expect(prisma.payment.findFirst).toHaveBeenCalledOnce();
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('calls verifyAndConfirmPayment using the booking owner userId', async () => {
    const { service, prisma, paystack, bookings } = buildService();
    paystack.verifyWebhookSignature.mockReturnValue(true);
    // First findFirst: idempotency check → not terminal
    // Second findFirst: load payment for userId lookup
    const payment = makePayment();
    prisma.payment.findFirst
      .mockResolvedValueOnce(null)          // idempotency check
      .mockResolvedValueOnce(payment);      // load payment for userId
    prisma.payment.findUnique.mockResolvedValue(payment);
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', channel: 'card', reference: payment.reference });
    prisma.payment.update.mockResolvedValue({ ...payment, status: PaymentStatus.SUCCESS });
    bookings.confirmBooking.mockResolvedValue({});

    const payload = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } }));

    await service.handleWebhook(payload, 'valid-sig');

    expect(bookings.confirmBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });
});

// ---------------------------------------------------------------------------
// refundPayment
// ---------------------------------------------------------------------------

describe('PaymentsService — refundPayment', () => {
  it('throws NotFoundException when payment does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.refundPayment('pay-x', 'user-1', { reason: 'Changed mind' }))
      .rejects.toThrow('Payment not found');
  });

  it('throws BadRequestException when payment status is not SUCCESS', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(makePayment({ status: PaymentStatus.PENDING }));

    await expect(service.refundPayment('pay-1', 'user-1', { reason: 'Changed mind' }))
      .rejects.toThrow('BadRequestException');
  });

  it('throws BadRequestException when booking is not CONFIRMED or CHECKED_OUT', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({
        status: PaymentStatus.SUCCESS,
        booking: makeBooking({ status: BookingStatus.CANCELLED }),
      }),
    );

    await expect(service.refundPayment('pay-1', 'user-1', { reason: 'Changed mind' }))
      .rejects.toThrow('BadRequestException');
  });

  it('throws BadRequestException when refund amount exceeds payment amount', async () => {
    const { service, prisma } = buildService();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({
        status: PaymentStatus.SUCCESS,
        booking: makeBooking({ status: BookingStatus.CONFIRMED }),
      }),
    );

    await expect(
      service.refundPayment('pay-1', 'user-1', { reason: 'Changed mind', amountNgn: 99999 }),
    ).rejects.toThrow('Refund amount cannot exceed the original payment amount');
  });

  it('creates refund, updates payment to REFUNDED, calls Paystack and cancelBooking', async () => {
    const { service, prisma, paystack, bookings } = buildService();
    const payment = makePayment({
      status: PaymentStatus.SUCCESS,
      booking: makeBooking({ status: BookingStatus.CONFIRMED }),
    });
    const refundRecord = {
      id: 'refund-1',
      paymentId: 'pay-1',
      amountNgn: 10000,
      reason: 'Changed mind',
      status: RefundStatus.PENDING,
    };
    const updatedRefund = { ...refundRecord, status: RefundStatus.PROCESSING };

    prisma.payment.findUnique.mockResolvedValue(payment);
    prisma.refund.create.mockResolvedValue(refundRecord);
    prisma.payment.update.mockResolvedValue({ ...payment, status: PaymentStatus.REFUNDED });
    paystack.createRefund.mockResolvedValue({ status: 'pending' });
    prisma.refund.update.mockResolvedValue(updatedRefund);
    bookings.cancelBooking.mockResolvedValue({});

    const result = await service.refundPayment('pay-1', 'user-1', { reason: 'Changed mind' });

    // Refund record created first
    expect(prisma.refund.create).toHaveBeenCalledBefore(prisma.payment.update as never);
    // Payment marked REFUNDED
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PaymentStatus.REFUNDED } }),
    );
    // Paystack called
    expect(paystack.createRefund).toHaveBeenCalledOnce();
    // Booking cancelled
    expect(bookings.cancelBooking).toHaveBeenCalledWith('booking-1', 'user-1', { reason: 'Changed mind' });
    // Final refund status is PROCESSING
    expect(result.status).toBe(RefundStatus.PROCESSING);
  });
});
