import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HotelsController } from './hotels.controller.js';
import { HotelsService } from './hotels.service.js';
import { ImagesService } from './images.service.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [HotelsController],
  providers: [HotelsService, ImagesService, DocumentsService],
  exports: [HotelsService],
})
export class HotelsModule {}
