import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { NOTIFICATION_QUEUE, NotificationJobType } from './notification-queues.js';

type BookingConfirmationData = {
  guestEmail: string;
  guestName: string;
  hotelName: string;
  bookingReference: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalNgn: string | number;
};

type BookingCancelledData = {
  guestEmail: string;
  guestName: string;
  hotelName: string;
  bookingReference: string;
  reason: string;
};

type CheckInReminderData = {
  guestEmail: string;
  guestName: string;
  hotelName: string;
  bookingReference: string;
  checkIn: string;
};

type WelcomeEmailData = {
  email: string;
  firstName: string;
};

type HotelApprovedData = {
  ownerEmail: string;
  ownerName: string;
  hotelName: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    private readonly mailerService: MailerService,
  ) {}

  async sendBookingConfirmation(booking: BookingConfirmationData): Promise<void> {
    await this.mailerService.sendMail({
      to: booking.guestEmail,
      subject: `Booking Confirmed — ${booking.hotelName}`,
      template: 'booking-confirmation',
      context: booking,
    });
  }

  async sendBookingCancelled(booking: BookingCancelledData): Promise<void> {
    await this.mailerService.sendMail({
      to: booking.guestEmail,
      subject: `Booking Cancelled — ${booking.bookingReference}`,
      template: 'booking-cancelled',
      context: booking,
    });
  }

  async sendCheckInReminder(booking: CheckInReminderData): Promise<void> {
    await this.mailerService.sendMail({
      to: booking.guestEmail,
      subject: `Check-in Reminder — ${booking.hotelName}`,
      template: 'check-in-reminder',
      context: booking,
    });
  }

  async sendWelcomeEmail(user: WelcomeEmailData): Promise<void> {
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Welcome to Hotel OS',
      template: 'welcome',
      context: user,
    });
  }

  async sendHotelApprovedEmail(hotel: HotelApprovedData): Promise<void> {
    await this.mailerService.sendMail({
      to: hotel.ownerEmail,
      subject: `Your hotel ${hotel.hotelName} is now live on Hotel OS`,
      template: 'hotel-approved',
      context: hotel,
    });
  }

  async queueNotification(
    type: NotificationJobType,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.notificationQueue.add(type, data);
    this.logger.log(`Queued notification job: ${type}`);
  }
}
