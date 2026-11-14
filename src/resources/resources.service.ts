import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Resource,
  type ResourceCategory,
  type Building,
  type Floor,
  type ResourceImage,
  type ResourceType,
  ResourceLifecycleStatus,
  type Prisma,
} from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateResourceCategoryDto } from './dto/create-resource-category.dto.js';
import { UpdateResourceCategoryDto } from './dto/update-resource-category.dto.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { BulkCreateResourcesDto } from './dto/bulk-create-resources.dto.js';
import { UpdateOperationalStatusDto } from './dto/update-operational-status.dto.js';
import { AddResourceImageDto } from './dto/add-resource-image.dto.js';
import { ResourceQueryDto } from './dto/resource-query.dto.js';

@Injectable()
export class ResourcesService {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'hotel-images')!;
  }

  // ─── Ownership helpers ────────────────────────────────────────────────────

  private async verifyHotelOwnership(hotelId: string, ownerId: string): Promise<void> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException(`Hotel ${hotelId} not found`);
    if (hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }
  }

  private async verifyResourceOwnership(
    resourceId: string,
    ownerId: string,
  ): Promise<Resource & { category: ResourceCategory }> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        category: true,
        hotel: true,
      },
    });
    if (!resource) throw new NotFoundException(`Resource ${resourceId} not found`);
    if (resource.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }
    return resource as Resource & { category: ResourceCategory };
  }

  // ─── Resource Types ───────────────────────────────────────────────────────

  async getResourceTypes(): Promise<ResourceType[]> {
    return this.prisma.resourceType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ─── Resource Categories ──────────────────────────────────────────────────

  async createCategory(
    hotelId: string,
    ownerId: string,
    dto: CreateResourceCategoryDto,
  ): Promise<ResourceCategory> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    // Verify resourceType exists
    const resourceType = await this.prisma.resourceType.findUnique({
      where: { id: dto.resourceTypeId },
    });
    if (!resourceType) {
      throw new NotFoundException(`ResourceType ${dto.resourceTypeId} not found`);
    }

    return this.prisma.resourceCategory.create({
      data: {
        hotelId,
        resourceTypeId: dto.resourceTypeId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        defaultBookingUnit: dto.defaultBookingUnit,
        defaultCapacity: dto.defaultCapacity,
        defaultMinimumDurationMinutes: dto.defaultMinimumDurationMinutes,
        defaultMaximumDurationMinutes: dto.defaultMaximumDurationMinutes,
        isActive: dto.isActive ?? true,
      },
      include: { resourceType: true },
    });
  }

  async getCategories(hotelId: string): Promise<ResourceCategory[]> {
    return this.prisma.resourceCategory.findMany({
      where: { hotelId },
      include: {
        resourceType: true,
        _count: { select: { resources: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCategoryById(categoryId: string): Promise<ResourceCategory> {
    const category = await this.prisma.resourceCategory.findUnique({
      where: { id: categoryId },
      include: { resourceType: true },
    });
    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    return category;
  }

  async updateCategory(
    categoryId: string,
    ownerId: string,
    dto: UpdateResourceCategoryDto,
  ): Promise<ResourceCategory> {
    const category = await this.prisma.resourceCategory.findUnique({
      where: { id: categoryId },
      include: { hotel: true },
    });
    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    if (category.hotel.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this hotel');
    }

    return this.prisma.resourceCategory.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        description: dto.description,
        defaultBookingUnit: dto.defaultBookingUnit,
        defaultCapacity: dto.defaultCapacity,
        defaultMinimumDurationMinutes: dto.defaultMinimumDurationMinutes,
        defaultMaximumDurationMinutes: dto.defaultMaximumDurationMinutes,
        isActive: dto.isActive,
      },
      include: { resourceType: true },
    });
  }

  // ─── Buildings ────────────────────────────────────────────────────────────

  async createBuilding(
    hotelId: string,
    ownerId: string,
    dto: CreateBuildingDto,
  ): Promise<Building> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    return this.prisma.building.create({
      data: {
        hotelId,
        name: dto.name,
        code: dto.code.toUpperCase(),
      },
      include: { floors: true },
    });
  }

  async getBuildings(hotelId: string): Promise<Building[]> {
    return this.prisma.building.findMany({
      where: { hotelId },
      include: {
        floors: { orderBy: { levelNumber: 'asc' } },
        _count: { select: { resources: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createFloor(
    hotelId: string,
    buildingId: string,
    ownerId: string,
    dto: CreateFloorDto,
  ): Promise<Floor> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    // Verify building belongs to this hotel
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, hotelId },
    });
    if (!building) throw new NotFoundException(`Building ${buildingId} not found in hotel`);

    return this.prisma.floor.create({
      data: {
        hotelId,
        buildingId,
        name: dto.name,
        levelNumber: dto.levelNumber,
      },
    });
  }

  // ─── Resources ────────────────────────────────────────────────────────────

  async createResource(
    hotelId: string,
    ownerId: string,
    dto: CreateResourceDto,
  ): Promise<Resource> {
    await this.verifyHotelOwnership(hotelId, ownerId);
    await this.validateResourceRelations(hotelId, dto);

    return this.prisma.resource.create({
      data: {
        hotelId,
        resourceCategoryId: dto.resourceCategoryId,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        bookingUnit: dto.bookingUnit,
        isBookable: dto.isBookable ?? true,
        marketplaceVisibility: dto.marketplaceVisibility ?? 'PRIVATE',
        capacity: dto.capacity,
        minimumCapacity: dto.minimumCapacity,
        minimumDurationMinutes: dto.minimumDurationMinutes,
        maximumDurationMinutes: dto.maximumDurationMinutes,
        bufferBeforeMinutes: dto.bufferBeforeMinutes ?? 0,
        bufferAfterMinutes: dto.bufferAfterMinutes ?? 0,
        attributes: dto.attributes as Prisma.InputJsonValue,
        internalNotes: dto.internalNotes,
      },
      include: {
        category: { include: { resourceType: true } },
        building: true,
        floor: true,
        images: true,
      },
    });
  }

  async bulkCreateResources(
    hotelId: string,
    ownerId: string,
    dto: BulkCreateResourcesDto,
  ): Promise<{ created: Resource[]; errors: { code: string; error: string }[] }> {
    await this.verifyHotelOwnership(hotelId, ownerId);

    // Validate the category belongs to this hotel
    const category = await this.prisma.resourceCategory.findFirst({
      where: { id: dto.resourceCategoryId, hotelId },
      include: { resourceType: true },
    });
    if (!category) {
      throw new NotFoundException(
        `ResourceCategory ${dto.resourceCategoryId} not found in this hotel`,
      );
    }

    if (dto.buildingId) {
      const building = await this.prisma.building.findFirst({
        where: { id: dto.buildingId, hotelId },
      });
      if (!building) {
        throw new NotFoundException(
          `Building ${dto.buildingId} not found in this hotel`,
        );
      }
    }

    if (dto.floorId) {
      const floor = await this.prisma.floor.findFirst({
        where: { id: dto.floorId, hotelId },
      });
      if (!floor) {
        throw new NotFoundException(`Floor ${dto.floorId} not found in this hotel`);
      }
    }

    // Check for duplicates within request
    const requestCodes = dto.resources.map((r) => r.code);
    const uniqueRequestCodes = new Set(requestCodes);
    if (uniqueRequestCodes.size !== requestCodes.length) {
      throw new BadRequestException(
        'Duplicate codes found within the bulk request',
      );
    }

    // Check for existing conflicts in the DB
    const existingResources = await this.prisma.resource.findMany({
      where: { hotelId, code: { in: requestCodes } },
      select: { code: true },
    });
    const existingCodes = new Set(existingResources.map((r) => r.code));
    const conflicting = requestCodes.filter((c) => existingCodes.has(c));
    if (conflicting.length > 0) {
      throw new ConflictException(
        `Resource codes already exist in this hotel: ${conflicting.join(', ')}`,
      );
    }

    // All-or-nothing transaction
    const created = await this.prisma.$transaction(
      dto.resources.map((item) =>
        this.prisma.resource.create({
          data: {
            hotelId,
            resourceCategoryId: dto.resourceCategoryId,
            buildingId: dto.buildingId,
            floorId: dto.floorId,
            name: item.name,
            code: item.code,
            bookingUnit: dto.bookingUnit ?? category.defaultBookingUnit,
            isBookable: dto.isBookable ?? true,
            marketplaceVisibility: dto.marketplaceVisibility ?? 'PRIVATE',
            capacity: item.capacity ?? category.defaultCapacity,
            attributes: item.attributes as Prisma.InputJsonValue,
          },
          include: {
            category: { include: { resourceType: true } },
            images: true,
          },
        }),
      ),
    );

    return { created, errors: [] };
  }

  async listResources(hotelId: string, query: ResourceQueryDto): Promise<Resource[]> {
    const where: Prisma.ResourceWhereInput = { hotelId };

    if (query.categoryId) where.resourceCategoryId = query.categoryId;
    if (query.buildingId) where.buildingId = query.buildingId;
    if (query.floorId) where.floorId = query.floorId;
    if (query.lifecycleStatus) where.lifecycleStatus = query.lifecycleStatus;
    if (query.operationalStatus) where.operationalStatus = query.operationalStatus;
    if (query.marketplaceVisibility) where.marketplaceVisibility = query.marketplaceVisibility;
    if (query.bookingUnit) where.bookingUnit = query.bookingUnit;
    if (query.isBookable !== undefined) where.isBookable = query.isBookable;

    return this.prisma.resource.findMany({
      where,
      include: {
        category: { include: { resourceType: true } },
        building: true,
        floor: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async getResourceById(resourceId: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        category: { include: { resourceType: true } },
        building: true,
        floor: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });
    if (!resource) throw new NotFoundException(`Resource ${resourceId} not found`);
    return resource;
  }

  async updateResource(
    resourceId: string,
    ownerId: string,
    dto: UpdateResourceDto,
  ): Promise<Resource> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        name: dto.name,
        description: dto.description,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        bookingUnit: dto.bookingUnit,
        isBookable: dto.isBookable,
        marketplaceVisibility: dto.marketplaceVisibility,
        capacity: dto.capacity,
        minimumCapacity: dto.minimumCapacity,
        minimumDurationMinutes: dto.minimumDurationMinutes,
        maximumDurationMinutes: dto.maximumDurationMinutes,
        bufferBeforeMinutes: dto.bufferBeforeMinutes,
        bufferAfterMinutes: dto.bufferAfterMinutes,
        attributes: dto.attributes as Prisma.InputJsonValue,
        internalNotes: dto.internalNotes,
      },
      include: {
        category: { include: { resourceType: true } },
        building: true,
        floor: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });
  }

  async updateOperationalStatus(
    resourceId: string,
    ownerId: string,
    dto: UpdateOperationalStatusDto,
  ): Promise<Resource> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        operationalStatus: dto.operationalStatus,
        ...(dto.notes !== undefined && { internalNotes: dto.notes }),
      },
      include: {
        category: { include: { resourceType: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });
  }

  async archiveResource(resourceId: string, ownerId: string): Promise<Resource> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        lifecycleStatus: ResourceLifecycleStatus.ARCHIVED,
        isBookable: false,
        marketplaceVisibility: 'PRIVATE',
        archivedAt: new Date(),
      },
      include: {
        category: { include: { resourceType: true } },
        images: true,
      },
    });
  }

  // ─── Resource Images ──────────────────────────────────────────────────────

  async addImage(
    resourceId: string,
    ownerId: string,
    dto: AddResourceImageDto,
  ): Promise<ResourceImage> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    if (dto.isPrimary) {
      await this.prisma.resourceImage.updateMany({
        where: { resourceId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.resourceImage.create({
      data: {
        resourceId,
        url: dto.url,
        caption: dto.caption,
        isPrimary: dto.isPrimary ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async getImages(resourceId: string): Promise<ResourceImage[]> {
    return this.prisma.resourceImage.findMany({
      where: { resourceId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async deleteImage(
    resourceId: string,
    imageId: string,
    ownerId: string,
  ): Promise<void> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    const image = await this.prisma.resourceImage.findFirst({
      where: { id: imageId, resourceId },
    });
    if (!image) throw new NotFoundException(`Image ${imageId} not found`);

    // Remove from Supabase storage if URL matches bucket
    const marker = `/object/public/${this.bucket}/`;
    const markerIndex = image.url.indexOf(marker);
    if (markerIndex !== -1) {
      const storagePath = image.url.slice(markerIndex + marker.length);
      await this.supabase.storage.from(this.bucket).remove([storagePath]);
    }

    await this.prisma.resourceImage.delete({ where: { id: imageId } });
  }

  async setPrimaryImage(
    resourceId: string,
    imageId: string,
    ownerId: string,
  ): Promise<ResourceImage> {
    await this.verifyResourceOwnership(resourceId, ownerId);

    const image = await this.prisma.resourceImage.findFirst({
      where: { id: imageId, resourceId },
    });
    if (!image) throw new NotFoundException(`Image ${imageId} not found`);

    await this.prisma.resourceImage.updateMany({
      where: { resourceId },
      data: { isPrimary: false },
    });

    return this.prisma.resourceImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async validateResourceRelations(
    hotelId: string,
    dto: Pick<
      CreateResourceDto,
      'resourceCategoryId' | 'buildingId' | 'floorId'
    >,
  ): Promise<void> {
    // Category must belong to this hotel
    const category = await this.prisma.resourceCategory.findFirst({
      where: { id: dto.resourceCategoryId, hotelId },
    });
    if (!category) {
      throw new NotFoundException(
        `ResourceCategory ${dto.resourceCategoryId} not found in this hotel`,
      );
    }

    if (dto.buildingId) {
      const building = await this.prisma.building.findFirst({
        where: { id: dto.buildingId, hotelId },
      });
      if (!building) {
        throw new NotFoundException(
          `Building ${dto.buildingId} not found in this hotel`,
        );
      }
    }

    if (dto.floorId) {
      const floor = await this.prisma.floor.findFirst({
        where: { id: dto.floorId, hotelId },
      });
      if (!floor) {
        throw new NotFoundException(`Floor ${dto.floorId} not found in this hotel`);
      }

      // Floor must belong to the specified building (if both given)
      if (dto.buildingId && floor.buildingId !== dto.buildingId) {
        throw new BadRequestException(
          `Floor ${dto.floorId} does not belong to building ${dto.buildingId}`,
        );
      }
    }
  }
}
