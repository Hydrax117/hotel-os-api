import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { RoomServiceController } from './room-service.controller.js';
import { RoomServiceService } from './room-service.service.js';
import { RoomServiceGateway } from './room-service.gateway.js';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [RoomServiceController],
  providers: [RoomServiceService, RoomServiceGateway],
  exports: [RoomServiceService, RoomServiceGateway],
})
export class RoomServiceModule {}
