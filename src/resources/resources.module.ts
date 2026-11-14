import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
  ResourceTypesController,
  ResourcesController,
  ResourceInstanceController,
  ResourceCategoryInstanceController,
} from './resources.controller.js';
import { ResourcesService } from './resources.service.js';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [
    ResourceTypesController,
    ResourcesController,
    ResourceInstanceController,
    ResourceCategoryInstanceController,
  ],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
