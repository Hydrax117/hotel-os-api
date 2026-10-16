import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  type Subscription,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { type ChangePlanDto } from './dto/change-plan.dto.js';
import { SUBSCRIPTION_PLANS } from './subscription-plans.js';

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async verifyHotelOwnership(hotelId: string, ownerId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException();
    return hotel;
  }

  async createSubscription(
    hotelId: string,
    ownerId: string,
    dto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    const existing = await this.prisma.subscription.findFirst({
      where: {
        hotelId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
    });

    if (existing) throw new ConflictException('Hotel already has an active subscription');

    const startDate = new Date();
    const nextBilling = addMonths(startDate, 1);
    const priceNgn = SUBSCRIPTION_PLANS[dto.plan].priceNgn;

    const [subscription] = await this.prisma.$transaction([
      this.prisma.subscription.create({
        data: {
          hotelId,
          plan: dto.plan,
          status: SubscriptionStatus.ACTIVE,
          priceNgn,
          startDate,
          nextBilling,
        },
      }),
      this.prisma.hotel.update({
        where: { id: hotelId },
        data: { subscriptionPlan: dto.plan },
      }),
    ]);

    return subscription;
  }

  async getSubscription(hotelId: string, ownerId: string): Promise<Subscription> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    const subscription = await this.prisma.subscription.findFirst({
      where: { hotelId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    return subscription;
  }

  async changePlan(
    hotelId: string,
    ownerId: string,
    dto: ChangePlanDto,
  ): Promise<Subscription> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    const subscription = await this.prisma.subscription.findFirst({
      where: { hotelId, status: SubscriptionStatus.ACTIVE },
    });

    if (!subscription) throw new BadRequestException('No active subscription found');

    const priceNgn = SUBSCRIPTION_PLANS[dto.plan].priceNgn;

    const [updated] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { plan: dto.plan, priceNgn },
      }),
      this.prisma.hotel.update({
        where: { id: hotelId },
        data: { subscriptionPlan: dto.plan },
      }),
    ]);

    return updated;
  }

  async cancelSubscription(hotelId: string, ownerId: string): Promise<Subscription> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        hotelId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
    });

    if (!subscription) throw new NotFoundException('No active subscription found');

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.ARCHIVED },
    });
  }

  async getAvailablePlans(): Promise<
    (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS][]
  > {
    return Object.values(SUBSCRIPTION_PLANS);
  }

  async suspendSubscription(hotelId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hotelId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.SUSPENDED },
      }),
      this.prisma.hotel.update({
        where: { id: hotelId },
        data: { isPublished: false },
      }),
    ]);

    return updated;
  }

  async reactivateSubscription(hotelId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hotelId },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, gracePeriodEnd: null },
      }),
      this.prisma.hotel.update({
        where: { id: hotelId },
        data: { isPublished: true },
      }),
    ]);

    return updated;
  }

  async checkExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    let changed = 0;

    // Active subscriptions past their billing date → move to GRACE_PERIOD
    const overdueActive = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, nextBilling: { lt: now } },
    });

    for (const sub of overdueActive) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: addDays(sub.nextBilling, 7),
        },
      });
      changed++;
    }

    // Grace period subscriptions past their grace end → SUSPENDED + unpublish hotel
    const expiredGrace = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd: { lt: now },
      },
    });

    for (const sub of expiredGrace) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.SUSPENDED },
        }),
        this.prisma.hotel.update({
          where: { id: sub.hotelId },
          data: { isPublished: false },
        }),
      ]);
      changed++;
    }

    return changed;
  }

  async initializePayment(
    hotelId: string,
    ownerId: string,
    plan: SubscriptionPlan,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new InternalServerErrorException('Payment gateway not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Owner not found');

    const priceKobo = SUBSCRIPTION_PLANS[plan].priceNgn * 100;
    const reference = `sub_${hotelId}_${Date.now()}`;
    const callbackUrl =
      (process.env.HOTEL_FRONTEND_URL ?? 'http://hotel.localhost:3000') +
      '/dashboard/subscription/callback';

    const paystackRes = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: priceKobo,
          reference,
          callback_url: callbackUrl,
          metadata: { hotelId, plan, ownerId },
        }),
      },
    );

    const paystackData = (await paystackRes.json()) as {
      status: boolean;
      message: string;
      data: { authorization_url: string; reference: string };
    };

    if (!paystackData.status) {
      throw new BadRequestException(
        paystackData.message ?? 'Could not initialize payment. Please try again.',
      );
    }

    return {
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    };
  }

  async verifyPayment(
    hotelId: string,
    ownerId: string,
    reference: string,
  ): Promise<Subscription> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    // Idempotency check: if an active subscription already exists, return it
    // directly so hitting this endpoint twice (e.g. browser back + forward) does
    // not surface a 409 ConflictException to the user.
    const existingSub = await this.prisma.subscription.findFirst({
      where: {
        hotelId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
      },
    });
    if (existingSub) return existingSub;

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new InternalServerErrorException('Payment gateway not configured');
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const paystackData = (await paystackRes.json()) as {
      status: boolean;
      data: {
        status: string;
        metadata: { plan: string; hotelId: string; ownerId: string };
      };
    };

    if (paystackData.data.status !== 'success') {
      throw new BadRequestException(
        'Payment verification failed. Please try again or contact support if you were charged.',
      );
    }

    const rawPlan = paystackData.data.metadata.plan;
    const validPlans = Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlan[];
    if (!validPlans.includes(rawPlan as SubscriptionPlan)) {
      throw new BadRequestException(
        `Invalid subscription plan "${rawPlan}" received from payment provider. Please contact support.`,
      );
    }
    const planFromMeta = rawPlan as SubscriptionPlan;

    return this.createSubscription(hotelId, ownerId, { plan: planFromMeta });
  }

  // Keep SubscriptionPlan import used to satisfy TS (referenced via dto.plan type checks)
  getPlanByKey(key: SubscriptionPlan) {
    return SUBSCRIPTION_PLANS[key];
  }
}
