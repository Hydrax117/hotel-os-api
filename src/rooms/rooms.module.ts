import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [PrismaModule, forwardRef(() => InventoryModule)],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
