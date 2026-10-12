import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
