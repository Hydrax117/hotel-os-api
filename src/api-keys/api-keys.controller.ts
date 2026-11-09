import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type JwtUser } from '../auth/strategies/jwt.strategy.js';

@ApiTags('api-keys')
@Controller('hotels/:hotelId/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new API key for the hotel' })
  createApiKey(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createApiKey(hotelId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active API keys for the hotel' })
  listApiKeys(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.apiKeysService.listApiKeys(hotelId, user.userId);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeApiKey(
    @Param('keyId') keyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.apiKeysService.revokeApiKey(keyId, user.userId);
  }
}
