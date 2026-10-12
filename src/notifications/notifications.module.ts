import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { NotificationsService } from './notifications.service.js';
import { NotificationsConsumer } from './notifications.consumer.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';
import { NOTIFICATION_QUEUE } from './notification-queues.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST') ?? 'smtp.mailtrap.io',
          port: config.get<number>('SMTP_PORT') ?? 587,
          auth: {
            user: config.get('SMTP_USER') ?? '',
            pass: config.get('SMTP_PASS') ?? '',
          },
        },
        defaults: { from: config.get('SMTP_FROM') ?? '"Hotel OS" <noreply@hotel-os.com>' },
        template: {
          dir: join(process.cwd(), 'src/notifications/templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
    BookingsModule,
    SubscriptionsModule,
    PrismaModule,
  ],
  providers: [NotificationsService, NotificationsConsumer, ScheduledJobsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
