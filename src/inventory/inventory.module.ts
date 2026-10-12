import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [PrismaModule, forwardRef(() => RoomsModule)],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
