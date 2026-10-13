import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { HotelsService } from './hotels.service.js';
import { ImagesService } from './images.service.js';
import { CreateHotelDto } from './dto/create-hotel.dto.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';
import { HotelQueryDto } from './dto/hotel-query.dto.js';
import { ApproveHotelDto } from './dto/approve-hotel.dto.js';
import { AddImageDto } from './dto/add-image.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(
    private hotelsService: HotelsService,
    private imagesService: ImagesService,
  ) {}

  // PUBLIC — no auth
  @Get()
  @ApiOperation({ summary: 'List all approved hotels' })
  @ApiResponse({ status: 200 })
  findAll(@Query() query: HotelQueryDto) {
    return this.hotelsService.findAll(query);
  }

  // HOTEL OWNER — must be BEFORE /:id to avoid 'my' being treated as an id param
  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the currently authenticated owner's hotel" })
  getMyHotel(@CurrentUser() user: JwtUser) {
    return this.hotelsService.getMyHotel(user.userId);
  }

  // ADMIN — must be BEFORE /:id
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List hotels pending verification (admin)' })
  getPendingVerifications() {
    return this.hotelsService.getPendingVerifications();
  }

  // PUBLIC
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get hotel by URL slug (public detail page)' })
  findBySlug(@Param('slug') slug: string) {
    return this.hotelsService.findBySlug(slug);
  }

  // PUBLIC — dynamic param route last among GETs
  @Get(':id')
  @ApiOperation({ summary: 'Get hotel by ID' })
  findById(@Param('id') id: string) {
    return this.hotelsService.findById(id);
  }

  // HOTEL OWNER
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new hotel (one per owner)' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateHotelDto) {
    return this.hotelsService.create(user.userId, dto);
  }

  // HOTEL OWNER
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hotel details (owner only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateHotelDto,
  ) {
    return this.hotelsService.update(id, user.userId, dto);
  }

  // ADMIN
  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve, reject, or suspend a hotel (admin)' })
  updateVerificationStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ApproveHotelDto,
  ) {
    return this.hotelsService.updateVerificationStatus(id, dto, user.userId);
  }

  // HOTEL OWNER — images
  @Get(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all images for a hotel (owner)' })
  getImages(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.imagesService.getImages(id, user.userId);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an image to a hotel (owner)' })
  @ApiResponse({ status: 201 })
  addImage(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AddImageDto,
  ) {
    return this.imagesService.addImage(id, user.userId, dto);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an image from a hotel (owner)' })
  deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.imagesService.deleteImage(id, imageId, user.userId);
  }

  @Patch(':id/images/:imageId/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set an image as the primary image for a hotel (owner)' })
  setPrimary(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.imagesService.setPrimary(id, imageId, user.userId);
  }
}
