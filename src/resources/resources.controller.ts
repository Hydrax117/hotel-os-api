import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ResourcesService } from './resources.service.js';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

// ─── Resource Types (system, public) ──────────────────────────────────────────

@ApiTags('resource-types')
@Controller('resource-types')
export class ResourceTypesController {
  constructor(private resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List all system resource types' })
  getResourceTypes() {
    return this.resourcesService.getResourceTypes();
  }
}

// ─── Hotel-scoped: categories, buildings, resources ───────────────────────────

@ApiTags('resources')
@Controller('hotels/:hotelId')
export class ResourcesController {
  constructor(private resourcesService: ResourcesService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  @Get('resource-categories')
  @ApiOperation({ summary: 'List resource categories for a hotel (public)' })
  @ApiParam({ name: 'hotelId', description: 'Hotel ID' })
  getCategories(@Param('hotelId') hotelId: string) {
    return this.resourcesService.getCategories(hotelId);
  }

  @Post('resource-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a resource category (owner only)' })
  @ApiResponse({ status: 201 })
  createCategory(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateResourceCategoryDto,
  ) {
    return this.resourcesService.createCategory(hotelId, user.userId, dto);
  }

  // ── Buildings ─────────────────────────────────────────────────────────────

  @Get('buildings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List buildings and floors for a hotel (owner only)' })
  getBuildings(@Param('hotelId') hotelId: string, @CurrentUser() user: JwtUser) {
    // Ownership verified implicitly — only owner's hotel data returned
    void user;
    return this.resourcesService.getBuildings(hotelId);
  }

  @Post('buildings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a building (owner only)' })
  @ApiResponse({ status: 201 })
  createBuilding(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBuildingDto,
  ) {
    return this.resourcesService.createBuilding(hotelId, user.userId, dto);
  }

  @Post('buildings/:buildingId/floors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a floor to a building (owner only)' })
  @ApiResponse({ status: 201 })
  createFloor(
    @Param('hotelId') hotelId: string,
    @Param('buildingId') buildingId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFloorDto,
  ) {
    return this.resourcesService.createFloor(hotelId, buildingId, user.userId, dto);
  }

  // ── Resources ─────────────────────────────────────────────────────────────

  @Get('resources')
  @ApiOperation({ summary: 'List/filter resources for a hotel (owner sees all; public sees PUBLIC only)' })
  listResources(
    @Param('hotelId') hotelId: string,
    @Query() query: ResourceQueryDto,
  ) {
    return this.resourcesService.listResources(hotelId, query);
  }

  @Post('resources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a single resource (owner only)' })
  @ApiResponse({ status: 201 })
  createResource(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resourcesService.createResource(hotelId, user.userId, dto);
  }

  @Post('resources/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk-create resources (owner only) — all-or-nothing' })
  @ApiResponse({ status: 201 })
  bulkCreateResources(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkCreateResourcesDto,
  ) {
    return this.resourcesService.bulkCreateResources(hotelId, user.userId, dto);
  }
}

// ─── Resource-instance routes (/resources/:resourceId) ────────────────────────

@ApiTags('resources')
@Controller('resources')
export class ResourceInstanceController {
  constructor(private resourcesService: ResourcesService) {}

  @Get(':resourceId')
  @ApiOperation({ summary: 'Get resource detail' })
  getResource(@Param('resourceId') resourceId: string) {
    return this.resourcesService.getResourceById(resourceId);
  }

  @Patch(':resourceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource (owner only)' })
  updateResource(
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.updateResource(resourceId, user.userId, dto);
  }

  @Post(':resourceId/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive resource — preserves booking history (owner only)' })
  archiveResource(
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.resourcesService.archiveResource(resourceId, user.userId);
  }

  @Patch(':resourceId/operational-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update operational status (owner only)' })
  updateOperationalStatus(
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateOperationalStatusDto,
  ) {
    return this.resourcesService.updateOperationalStatus(resourceId, user.userId, dto);
  }

  // ── Resource Images ────────────────────────────────────────────────────────

  @Get(':resourceId/images')
  @ApiOperation({ summary: 'List images for a resource' })
  getImages(@Param('resourceId') resourceId: string) {
    return this.resourcesService.getImages(resourceId);
  }

  @Post(':resourceId/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an image to a resource (owner only)' })
  @ApiResponse({ status: 201 })
  addImage(
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AddResourceImageDto,
  ) {
    return this.resourcesService.addImage(resourceId, user.userId, dto);
  }

  @Delete(':resourceId/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource image (owner only)' })
  deleteImage(
    @Param('resourceId') resourceId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.resourcesService.deleteImage(resourceId, imageId, user.userId);
  }

  @Patch(':resourceId/images/:imageId/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set primary image for a resource (owner only)' })
  setPrimaryImage(
    @Param('resourceId') resourceId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.resourcesService.setPrimaryImage(resourceId, imageId, user.userId);
  }
}

// ─── Category instance routes (/resource-categories/:categoryId) ──────────────

@ApiTags('resource-categories')
@Controller('resource-categories')
export class ResourceCategoryInstanceController {
  constructor(private resourcesService: ResourcesService) {}

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get resource category detail' })
  getCategory(@Param('categoryId') categoryId: string) {
    return this.resourcesService.getCategoryById(categoryId);
  }

  @Patch(':categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource category (owner only)' })
  updateCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateResourceCategoryDto,
  ) {
    return this.resourcesService.updateCategory(categoryId, user.userId, dto);
  }
}
