import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SearchHotelsDto, SortBy } from './dto/search-hotels.dto.js';
import {
  type RoomAvailability,
  type HotelSearchResult,
  type SearchResponse,
} from './dto/search-result.dto.js';

const hotelSearchInclude = {
  images: { where: { isPrimary: true }, take: 1 },
  amenities: { include: { amenity: true } },
  roomTypes: { where: { isActive: true } },
  resources: {
    where: { lifecycleStatus: 'ACTIVE', isBookable: true, marketplaceVisibility: 'PUBLIC' },
    select: { id: true },
  },
  reviews: { select: { overallRating: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.HotelInclude;

type HotelSearchRow = Prisma.HotelGetPayload<{ include: typeof hotelSearchInclude }>;

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  private mapHotel(
    hotel: HotelSearchRow,
    availableRooms: RoomAvailability[] = [],
    checkIn: string | null = null,
    checkOut: string | null = null,
    nights: number | null = null,
  ): HotelSearchResult {
    const rating =
      hotel.reviews.length > 0
        ? hotel.reviews.reduce((s, r) => s + r.overallRating, 0) /
          hotel.reviews.length
        : null;

    return {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      city: hotel.city,
      state: hotel.state,
      address: hotel.address,
      description: hotel.description,
      rating,
      reviewCount: hotel._count.reviews,
      primaryImageUrl: hotel.images[0]?.url ?? null,
      amenities: hotel.amenities.map((a) => a.amenity.name),
      lowestPrice:
        hotel.roomTypes.length > 0
          ? Math.min(...hotel.roomTypes.map((r) => Number(r.pricePerNight)))
          : null,
      availableRooms,
      checkIn,
      checkOut,
      nights,
    };
  }

  private applySort(
    hotels: HotelSearchResult[],
    sortBy?: SortBy,
  ): HotelSearchResult[] {
    const sorted = [...hotels];
    switch (sortBy) {
      case SortBy.PRICE_ASC:
        return sorted.sort((a, b) => {
          if (a.lowestPrice === null && b.lowestPrice === null) return 0;
          if (a.lowestPrice === null) return 1;
          if (b.lowestPrice === null) return -1;
          return a.lowestPrice - b.lowestPrice;
        });
      case SortBy.PRICE_DESC:
        return sorted.sort((a, b) => {
          if (a.lowestPrice === null && b.lowestPrice === null) return 0;
          if (a.lowestPrice === null) return 1;
          if (b.lowestPrice === null) return -1;
          return b.lowestPrice - a.lowestPrice;
        });
      case SortBy.RATING:
        return sorted.sort((a, b) => {
          if (a.rating === null && b.rating === null) return 0;
          if (a.rating === null) return 1;
          if (b.rating === null) return -1;
          return b.rating - a.rating;
        });
      default:
        // Recommended: sort by rating desc, then by review count desc
        return sorted.sort((a, b) => {
          const rA = a.rating ?? -1;
          const rB = b.rating ?? -1;
          if (rB !== rA) return rB - rA;
          return b.reviewCount - a.reviewCount;
        });
    }
  }

  async searchHotels(dto: SearchHotelsDto): Promise<SearchResponse> {
    const where: Prisma.HotelWhereInput = {
      verificationStatus: 'APPROVED',
      isPublished: true,
      isActive: true,
    };

    if (dto.city) where.city = { contains: dto.city, mode: 'insensitive' };
    if (dto.state) where.state = { contains: dto.state, mode: 'insensitive' };
    if (dto.q) {
      // Match against name, city, or state so users can type a city name
      // (e.g. "lagos") and still get results.
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { city: { contains: dto.q, mode: 'insensitive' } },
        { state: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    if (dto.amenities?.length) {
      where.AND = dto.amenities.map((name) => ({
        amenities: {
          some: {
            amenity: { name: { equals: name, mode: 'insensitive' as const } },
          },
        },
      }));
    }

    // Price filter only applied at DB level when no dates are provided;
    // with dates we re-check against real availability prices below.
    if (
      !dto.checkIn &&
      !dto.checkOut &&
      (dto.minPrice !== undefined || dto.maxPrice !== undefined)
    ) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (dto.minPrice !== undefined) priceFilter.gte = dto.minPrice;
      if (dto.maxPrice !== undefined) priceFilter.lte = dto.maxPrice;
      where.roomTypes = { some: { pricePerNight: priceFilter, isActive: true } };
    }

    const hotels = await this.prisma.hotel.findMany({
      where,
      include: hotelSearchInclude,
    });

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const guests = dto.guests ?? 1;

    // ── Path B: dates supplied ─────────────────────────────────────────────
    if (dto.checkIn && dto.checkOut) {
      const checkInDate = new Date(dto.checkIn);
      const checkOutDate = new Date(dto.checkOut);
      const nights = Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const results = await Promise.all(
        hotels.map(async (hotel) => {
          const eligibleResources = hotel.resources ?? [];

          const roomAvailabilities = await Promise.all(
            eligibleResources.map(async (r) => {
              const avail = await this.inventoryService.checkAvailability(r.id, {
                checkIn: dto.checkIn!, checkOut: dto.checkOut!, guests,
              });
              return {
                roomTypeId:     r.id,
                name:           '',
                bedType:        '',
                capacity:       1,
                pricePerNight:  0,
                availableRooms: avail.availableCount,
                available:      avail.available,
                isResource:     true,
              } satisfies RoomAvailability;            }),
          );

          const filteredRooms = roomAvailabilities.filter(r => r.available);
          return this.mapHotel(hotel, filteredRooms, dto.checkIn!, dto.checkOut!, nights);
        }),
      );

      // Keep only hotels that have at least one available room.
      // filteredRooms above already strips unavailable entries, so checking
      // length > 0 is equivalent to (and clearer than) .some(r => r.available).
      let filtered = results.filter((h) => h.availableRooms.length > 0);

      if (dto.minRating !== undefined) {
        filtered = filtered.filter(
          (h) => h.rating !== null && h.rating >= dto.minRating!,
        );
      }

      filtered = this.applySort(filtered, dto.sortBy);
      const total = filtered.length;

      return {
        hotels: filtered.slice((page - 1) * limit, page * limit),
        total,
        page,
        limit,
        city: dto.city ?? null,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
      };
    }

    // ── Path A: no dates ───────────────────────────────────────────────────
    // Note: guest-count filtering is intentionally skipped here. `lowestPrice`
    // reflects the cheapest active room type regardless of capacity, giving
    // users a "starting from" price to browse results before selecting dates.
    // The dates path applies a strict capacity >= guests filter instead.
    let results = hotels.map((h) => this.mapHotel(h));

    if (dto.minRating !== undefined) {
      results = results.filter(
        (h) => h.rating !== null && h.rating >= dto.minRating!,
      );
    }

    results = this.applySort(results, dto.sortBy);
    const total = results.length;

    return {
      hotels: results.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit,
      city: dto.city ?? null,
      checkIn: null,
      checkOut: null,
    };
  }

  async getHotelDetail(
    idOrSlug: string,
    checkIn?: string,
    checkOut?: string,
    guests?: number,
  ) {
    const detailInclude = {
      images: true,
      amenities: { include: { amenity: true } },
      roomTypes: { where: { isActive: true } },
      // Include resources with their images and category
      resources: {
        where: {
          lifecycleStatus: 'ACTIVE',
          isBookable: true,
          marketplaceVisibility: 'PUBLIC',
        },
        include: {
          images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
          category: { include: { resourceType: true } },
        },
        orderBy: { code: 'asc' as const },
      },
      reviews: {
        select: {
          overallRating: true,
          title: true,
          body: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      verification: true,
      _count: { select: { reviews: true } },
    } satisfies Prisma.HotelInclude;

    const hotel = await this.prisma.hotel.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        verificationStatus: 'APPROVED',
        isPublished: true,
        isActive: true,
      },
      include: detailInclude,
    });

    if (!hotel) throw new NotFoundException(`Hotel not found: ${idOrSlug}`);

    const guestCount = guests ?? 1;
    let nights: number | null = null;
    let roomTypes: RoomAvailability[];

    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      nights = Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // roomTypes array is empty — all bookable inventory is now in resources
    roomTypes = [];

    // Map resources to the same RoomAvailability shape so the frontend
    // can render them in the same list (with their photos).
    // Resources don't have an InventoryDay model yet — show them as
    // available with no price (0) until rate plans are wired up.
    type ResourceWithImages = typeof hotel.resources[number];
    const resourceRooms: RoomAvailability[] = await Promise.all(
      (hotel.resources as ResourceWithImages[]).map(async (r) => {
        let available = true;
        if (checkIn && checkOut) {
          const avail = await this.inventoryService.checkAvailability(r.id, {
            checkIn, checkOut, guests: guestCount,
          });
          available = avail.available;
        }
        return {
          roomTypeId: r.id,
          name: r.name,
          bedType: r.attributes && typeof r.attributes === 'object' && 'bedConfiguration' in (r.attributes as object)
            ? String((r.attributes as Record<string, unknown>)['bedConfiguration'])
            : r.category.name,
          capacity: r.capacity ?? 1,
          pricePerNight: 0,
          availableRooms: available ? 1 : 0,
          available,
          images: r.images.map((img) => ({ url: img.url, isPrimary: img.isPrimary, caption: img.caption })),
          bookingUnit: r.bookingUnit,
          isResource: true,
          description: r.description,
        } satisfies RoomAvailability;
      }),
    );

    // Build a hotelSearchInclude-compatible shape for mapHotel
    const hotelForMap = {
      ...hotel,
      images: hotel.images.filter((img) => img.isPrimary).slice(0, 1),
      reviews: hotel.reviews.map((r) => ({ overallRating: r.overallRating })),
    } as unknown as HotelSearchRow;

    const base = this.mapHotel(
      hotelForMap,
      [...roomTypes, ...resourceRooms],
      checkIn ?? null,
      checkOut ?? null,
      nights,
    );

    return {
      ...base,
      fullReviews: hotel.reviews,
      images: hotel.images,
      verification: hotel.verification,
    };
  }

  async getPopularCities(): Promise<
    { city: string; state: string; hotelCount: number }[]
  > {
    const groups = await this.prisma.hotel.groupBy({
      by: ['city', 'state'],
      where: {
        isPublished: true,
        isActive: true,
        verificationStatus: 'APPROVED',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    return groups.map((g) => ({
      city: g.city,
      state: g.state,
      hotelCount: g._count.id,
    }));
  }

  async getFeaturedHotels(limit = 8): Promise<HotelSearchResult[]> {
    const hotels = await this.prisma.hotel.findMany({
      where: { verificationStatus: 'APPROVED', isPublished: true, isActive: true },
      include: hotelSearchInclude,
      orderBy: { reviews: { _count: 'desc' } },
      take: limit,
    });
    return hotels.map((h) => this.mapHotel(h));
  }
}
