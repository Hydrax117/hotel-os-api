import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreateApiKeyDto } from './dto/create-api-key.dto.js';

const BCRYPT_ROUNDS = 10;
const KEY_BYTES = 32; // 256-bit random key

/**
 * Generates a raw API key in the format:  hos_live_<hex>
 * Returns both the raw key (shown once) and a prefix for display.
 */
function generateRawKey(): { raw: string; prefix: string } {
  const hex = crypto.randomBytes(KEY_BYTES).toString('hex');
  const raw = `hos_live_${hex}`;
  // Show first 16 chars of full key as the display prefix
  const prefix = raw.slice(0, 16) + '••••••••••••••••';
  return { raw, prefix };
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new API key for a hotel. Returns the raw key (only shown once).
   */
  async createApiKey(
    hotelId: string,
    ownerId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ id: string; name: string; rawKey: string; prefix: string; createdAt: Date }> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');

    const { raw, prefix } = generateRawKey();
    const keyHash = await bcrypt.hash(raw, BCRYPT_ROUNDS);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        hotelId,
        name: dto.name,
        keyHash,
        prefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      rawKey: raw,   // ONLY returned here — not stored
      prefix,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * List all active API keys for a hotel (without the raw key).
   */
  async listApiKeys(hotelId: string, ownerId: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');

    return this.prisma.apiKey.findMany({
      where: { hotelId, isActive: true },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke (soft-delete) an API key.
   */
  async revokeApiKey(keyId: string, ownerId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { hotel: true },
    });
    if (!apiKey) throw new NotFoundException('API key not found');
    if (apiKey.hotel.ownerId !== ownerId) throw new ForbiddenException('You do not own this hotel');

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }

  /**
   * Validate an API key from an incoming request.
   * Returns the associated hotel if valid, throws UnauthorizedException otherwise.
   */
  async validateApiKey(rawKey: string) {
    if (!rawKey || !rawKey.startsWith('hos_live_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Find candidate keys by prefix match (first 16 chars) to avoid full-table bcrypt
    const prefix = rawKey.slice(0, 16);
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        prefix: { startsWith: prefix },
        isActive: true,
      },
      include: { hotel: true },
    });

    for (const candidate of candidates) {
      const valid = await bcrypt.compare(rawKey, candidate.keyHash);
      if (valid) {
        // Check expiry
        if (candidate.expiresAt && candidate.expiresAt < new Date()) {
          throw new UnauthorizedException('API key has expired');
        }
        // Update lastUsedAt asynchronously — don't block the request
        void this.prisma.apiKey.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        });
        return candidate.hotel;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
