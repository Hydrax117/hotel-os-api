import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { HotelApplicationsService } from './hotel-applications.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('hotel-applications')
@ApiBearerAuth()
@Controller('hotel-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HotelApplicationsController {
  constructor(private readonly service: HotelApplicationsService) {}

  /** Submit a new hotel application (hotel owner only) */
  @Post()
  @Roles(UserRole.HOTEL_OWNER)
  submitApplication(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.service.submitApplication(user.userId, dto);
  }

  /** Get the current owner's own application */
  @Get('my')
  @Roles(UserRole.HOTEL_OWNER)
  async getMyApplication(@CurrentUser() user: JwtUser) {
    const application = await this.service.getMyApplication(user.userId);
    if (!application) throw new NotFoundException('No application found for this account.');
    return application;
  }

  /** List all applications — admin only */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  listApplications(@Query('status') status?: string) {
    return this.service.listApplications(status);
  }

  /** Get a single application by id — admin only */
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  getApplicationById(@Param('id') id: string) {
    return this.service.getApplicationById(id);
  }

  /** Approve an application — admin only */
  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approveApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body('notes') notes?: string,
  ) {
    return this.service.approveApplication(id, user.userId, notes);
  }

  /** Reject an application — admin only */
  @Post(':id/reject')
  @Roles(UserRole.SUPER_ADMIN)
  rejectApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body('notes') notes: string,
  ) {
    return this.service.rejectApplication(id, user.userId, notes ?? '');
  }
}
