import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HotelsController } from './hotels.controller.js';
import { HotelsService } from './hotels.service.js';
import { ImagesService } from './images.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [HotelsController],
  providers: [HotelsService, ImagesService],
  exports: [HotelsService],
})
export class HotelsModule {}
