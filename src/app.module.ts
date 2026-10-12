import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { HotelsModule } from './hotels/hotels.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { SearchModule } from './search/search.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'hotel-os-api',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HotelsModule,
    RoomsModule,
    InventoryModule,
    SearchModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
