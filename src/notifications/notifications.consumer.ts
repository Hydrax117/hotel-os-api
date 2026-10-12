import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_QUEUE, NotificationJobType } from './notification-queues.js';

@Processor(NOTIFICATION_QUEUE)
export class NotificationsConsumer {
  private readonly logger = new Logger(NotificationsConsumer.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process({ name: NotificationJobType.BOOKING_CONFIRMATION })
  async handleBookingConfirmation(
    job: Job<Parameters<NotificationsService['sendBookingConfirmation']>[0]>,
  ): Promise<void> {
    try {
      await this.notificationsService.sendBookingConfirmation(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to process ${NotificationJobType.BOOKING_CONFIRMATION} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Process({ name: NotificationJobType.BOOKING_CANCELLED })
  async handleBookingCancelled(
    job: Job<Parameters<NotificationsService['sendBookingCancelled']>[0]>,
  ): Promise<void> {
    try {
      await this.notificationsService.sendBookingCancelled(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to process ${NotificationJobType.BOOKING_CANCELLED} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Process({ name: NotificationJobType.CHECK_IN_REMINDER })
  async handleCheckInReminder(
    job: Job<Parameters<NotificationsService['sendCheckInReminder']>[0]>,
  ): Promise<void> {
    try {
      await this.notificationsService.sendCheckInReminder(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to process ${NotificationJobType.CHECK_IN_REMINDER} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Process({ name: NotificationJobType.WELCOME_EMAIL })
  async handleWelcomeEmail(
    job: Job<Parameters<NotificationsService['sendWelcomeEmail']>[0]>,
  ): Promise<void> {
    try {
      await this.notificationsService.sendWelcomeEmail(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to process ${NotificationJobType.WELCOME_EMAIL} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Process({ name: NotificationJobType.HOTEL_APPROVED })
  async handleHotelApproved(
    job: Job<Parameters<NotificationsService['sendHotelApprovedEmail']>[0]>,
  ): Promise<void> {
    try {
      await this.notificationsService.sendHotelApprovedEmail(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to process ${NotificationJobType.HOTEL_APPROVED} (id: ${job.id})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
