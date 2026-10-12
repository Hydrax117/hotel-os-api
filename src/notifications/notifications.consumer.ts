import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_QUEUE, NotificationJobType } from './notification-queues.js';

@Processor(NOTIFICATION_QUEUE)
export class NotificationsConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationsConsumer.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<void> {
    try {
      switch (job.name as NotificationJobType) {
        case NotificationJobType.BOOKING_CONFIRMATION:
          await this.notificationsService.sendBookingConfirmation(
            job.data as Parameters<NotificationsService['sendBookingConfirmation']>[0],
          );
          break;

        case NotificationJobType.BOOKING_CANCELLED:
          await this.notificationsService.sendBookingCancelled(
            job.data as Parameters<NotificationsService['sendBookingCancelled']>[0],
          );
          break;

        case NotificationJobType.CHECK_IN_REMINDER:
          await this.notificationsService.sendCheckInReminder(
            job.data as Parameters<NotificationsService['sendCheckInReminder']>[0],
          );
          break;

        case NotificationJobType.WELCOME_EMAIL:
          await this.notificationsService.sendWelcomeEmail(
            job.data as Parameters<NotificationsService['sendWelcomeEmail']>[0],
          );
          break;

        case NotificationJobType.HOTEL_APPROVED:
          await this.notificationsService.sendHotelApprovedEmail(
            job.data as Parameters<NotificationsService['sendHotelApprovedEmail']>[0],
          );
          break;

        default:
          this.logger.warn(`Unknown notification job type: ${job.name}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to process notification job ${job.name} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
