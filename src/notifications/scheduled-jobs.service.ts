import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationJobType } from './notification-queues.js';

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredHolds(): Promise<void> {
    try {
      const count = await this.bookingsService.releaseExpiredHolds();
      if (count > 0) {
        this.logger.log(`Released ${count} expired booking holds`);
      }
    } catch (err) {
      this.logger.error(
        'Failed to release expired holds',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkSubscriptions(): Promise<void> {
    try {
      const count = await this.subscriptionsService.checkExpiredSubscriptions();
      if (count > 0) {
        this.logger.log(`Updated ${count} expired subscriptions`);
      }
    } catch (err) {
      this.logger.error(
        'Failed to check subscriptions',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron('0 8 * * *', { timeZone: 'UTC' })
  async sendCheckInReminders(): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const bookings = await this.prisma.booking.findMany({
        where: {
          checkIn: { gte: tomorrow, lt: dayAfter },
          status: BookingStatus.CONFIRMED,
        },
        include: { user: true, hotel: true },
      });

      for (const booking of bookings) {
        await this.notificationsService.queueNotification(
          NotificationJobType.CHECK_IN_REMINDER,
          {
            guestEmail: booking.guestEmail,
            guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
            hotelName: booking.hotel.name,
            bookingReference: booking.reference,
            checkIn: booking.checkIn.toISOString().slice(0, 10),
          },
        );
      }

      if (bookings.length > 0) {
        this.logger.log(`Queued ${bookings.length} check-in reminder notifications`);
      }
    } catch (err) {
      this.logger.error(
        'Failed to send check-in reminders',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
