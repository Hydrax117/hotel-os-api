import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { join } from 'node:path';
import { NotificationsService } from './notifications.service.js';
import { NotificationsConsumer } from './notifications.consumer.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NOTIFICATION_QUEUE } from './notification-queues.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
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
    // forwardRef breaks the circular dependency:
    // BookingsModule → NotificationsModule → BookingsModule
    forwardRef(() => BookingsModule),
    SubscriptionsModule,
    PrismaModule,
  ],
  providers: [
    NotificationsService,
    NotificationsConsumer,
    ScheduledJobsService,
    NotificationsGateway,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
