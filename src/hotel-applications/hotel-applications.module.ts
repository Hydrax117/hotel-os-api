import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HotelApplicationsService } from './hotel-applications.service.js';
import { HotelApplicationsController } from './hotel-applications.controller.js';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [HotelApplicationsService],
  controllers: [HotelApplicationsController],
  exports: [HotelApplicationsService],
})
export class HotelApplicationsModule {}
