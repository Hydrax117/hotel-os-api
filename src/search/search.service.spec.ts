import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock NestJS decorators and NotFoundException so Vitest never resolves the
// full @nestjs/common CJS package graph (which has directory imports that
// Vite's ESM resolver cannot follow).
// ---------------------------------------------------------------------------
vi.mock('@nestjs/common', async () => {
  class HttpException extends Error {
    constructor(
      public readonly message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'HttpException';
    }
  }
  class NotFoundException extends HttpException {
    constructor(message?: string) {
      super(message ?? 'Not Found', 404);
      this.name = 'NotFoundException';
    }
  }
  return {
    Injectable: () => () => undefined,
    NotFoundException,
    HttpException,
  };
});

vi.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class PrismaClient {},
}));

// @nestjs/swagger is imported transitively: search.service.ts → search-hotels.dto.ts →
// @nestjs/swagger (ApiPropertyOptional). swagger-explorer.js inside @nestjs/swagger does a
// CJS require('@nestjs/common/interfaces') which fails under Vitest's ESM resolver because
// @nestjs/common/interfaces.js doesn't exist at the package root (it's interfaces/index.js).
vi.mock('@nestjs/swagger', () => ({
  ApiTags: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiParam: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiPropertyOptional: () => () => undefined,
}));

// Also mock the prisma service module directly since it extends PrismaClient
vi.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaService {
    hotel = {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    };
  },
}));

// Mock inventory service module — this prevents loading get-availability.dto.ts
// which imports @nestjs/swagger, which transitively requires @nestjs/common/interfaces
// via a CJS require (swagger-explorer.js).
vi.mock('../inventory/inventory.service.js', () => ({
  InventoryService: class InventoryService {
    checkAvailability = vi.fn();
  },
}));

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are registered.
// ---------------------------------------------------------------------------
import { SearchService } from './search.service.js';
import { SortBy } from './dto/search-hotels.dto.js';
import type { HotelSearchResult } from './dto/search-result.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal HotelSearchResult for sort/filter tests. */
function makeResult(
  overrides: Partial<HotelSearchResult> & { id?: string } = {},
): HotelSearchResult {
  return {
    id: overrides.id ?? 'hotel-1',
    name: 'Test Hotel',
    slug: 'test-hotel',
    city: 'Lagos',
    state: 'Lagos',
    address: '1 Test Street',
    description: null,
    rating: null,
    reviewCount: 0,
    primaryImageUrl: null,
    amenities: [],
    lowestPrice: 100,
    availableRooms: [],
    checkIn: null,
    checkOut: null,
    nights: null,
    ...overrides,
  };
}

type FakeRoomType = {
  id: string;
  name: string;
  bedType: string;
  capacity: number;
  pricePerNight: number;
  totalRooms: number;
  isActive: boolean;
};

/** Minimal Prisma HotelSearchRow shape used by mapHotel. */
function makeHotelRow(overrides: {
  id?: string;
  name?: string;
  slug?: string;
  city?: string;
  state?: string;
  address?: string;
  description?: string | null;
  images?: { url: string; isPrimary: boolean }[];
  amenities?: { amenity: { name: string } }[];
  roomTypes?: FakeRoomType[];
  reviews?: { overallRating: number }[];
  _count?: { reviews: number };
} = {}) {
  return {
    id: overrides.id ?? 'hotel-1',
    name: overrides.name ?? 'Test Hotel',
    slug: overrides.slug ?? 'test-hotel',
    city: overrides.city ?? 'Lagos',
    state: overrides.state ?? 'Lagos',
    address: overrides.address ?? '1 Test Street',
    description: overrides.description ?? null,
    images: overrides.images ?? [{ url: 'http://img.test/1.jpg', isPrimary: true }],
    amenities: overrides.amenities ?? [{ amenity: { name: 'WiFi' } }],
    roomTypes: overrides.roomTypes ?? [
      {
        id: 'rt-1',
        name: 'Standard',
        bedType: 'Queen',
        capacity: 2,
        pricePerNight: 100,
        totalRooms: 5,
        isActive: true,
      },
    ],
    reviews: overrides.reviews ?? [],
    _count: overrides._count ?? { reviews: 0 },
  };
}

// ---------------------------------------------------------------------------
// Factory: build SearchService with mocked dependencies.
// ---------------------------------------------------------------------------

function buildService(
  findManyResult: unknown[] = [],
  findFirstResult: unknown = null,
  groupByResult: unknown[] = [],
  checkAvailabilityImpl?: (roomTypeId: string, dto: unknown) => Promise<unknown>,
): SearchService {
  const defaultAvail = (roomTypeId: string) =>
    Promise.resolve({
      available: true,
      roomTypeId,
      checkIn: '2025-09-01',
      checkOut: '2025-09-05',
      nights: 4,
      availableRooms: 3,
      pricePerNight: 120,
      totalPrice: 480,
      blockedDates: [],
    });

  const prisma = {
    hotel: {
      findMany: vi.fn().mockResolvedValue(findManyResult),
      findFirst: vi.fn().mockResolvedValue(findFirstResult),
      groupBy: vi.fn().mockResolvedValue(groupByResult),
    },
  };
  const inventory = {
    checkAvailability: vi.fn().mockImplementation(
      checkAvailabilityImpl ?? defaultAvail,
    ),
  };

  return new SearchService(prisma as any, inventory as any);
}

// ---------------------------------------------------------------------------
// mapHotel — tested via searchHotels Path A
// ---------------------------------------------------------------------------

describe('SearchService — mapHotel (via searchHotels Path A)', () => {
  it('returns rating=null when hotel has no reviews', async () => {
    const service = buildService([makeHotelRow({ reviews: [] })]);
    const result = await service.searchHotels({ city: 'Lagos' });
    expect(result.hotels[0].rating).toBeNull();
  });

  it('computes average rating from reviews', async () => {
    const service = buildService([
      makeHotelRow({
        reviews: [{ overallRating: 4 }, { overallRating: 5 }],
        _count: { reviews: 2 },
      }),
    ]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].rating).toBe(4.5);
  });

  it('sets lowestPrice=null when hotel has no active room types', async () => {
    const service = buildService([makeHotelRow({ roomTypes: [] })]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].lowestPrice).toBeNull();
  });

  it('sets lowestPrice to minimum of room type prices', async () => {
    const service = buildService([
      makeHotelRow({
        roomTypes: [
          { id: 'rt-1', name: 'Standard', bedType: 'Q', capacity: 2, pricePerNight: 200, totalRooms: 5, isActive: true },
          { id: 'rt-2', name: 'Deluxe', bedType: 'K', capacity: 3, pricePerNight: 150, totalRooms: 3, isActive: true },
        ],
      }),
    ]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].lowestPrice).toBe(150);
  });

  it('uses first primary image URL', async () => {
    const service = buildService([
      makeHotelRow({ images: [{ url: 'http://img.test/primary.jpg', isPrimary: true }] }),
    ]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].primaryImageUrl).toBe('http://img.test/primary.jpg');
  });

  it('sets primaryImageUrl=null when no images', async () => {
    const service = buildService([makeHotelRow({ images: [] })]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].primaryImageUrl).toBeNull();
  });

  it('maps amenity names', async () => {
    const service = buildService([
      makeHotelRow({
        amenities: [{ amenity: { name: 'Pool' } }, { amenity: { name: 'Gym' } }],
      }),
    ]);
    const result = await service.searchHotels({});
    expect(result.hotels[0].amenities).toEqual(['Pool', 'Gym']);
  });
});

// ---------------------------------------------------------------------------
// applySort — tested via searchHotels Path A
// ---------------------------------------------------------------------------

describe('SearchService — applySort (via searchHotels Path A)', () => {
  it('PRICE_ASC sorts by lowestPrice ascending, null last', async () => {
    const rows = [
      makeHotelRow({ id: 'h1', roomTypes: [{ id: 'rt-1', name: 'A', bedType: 'Q', capacity: 2, pricePerNight: 200, totalRooms: 5, isActive: true }] }),
      makeHotelRow({ id: 'h2', roomTypes: [] }),
      makeHotelRow({ id: 'h3', roomTypes: [{ id: 'rt-2', name: 'B', bedType: 'Q', capacity: 2, pricePerNight: 100, totalRooms: 5, isActive: true }] }),
    ];
    const service = buildService(rows);
    const result = await service.searchHotels({ sortBy: SortBy.PRICE_ASC });
    expect(result.hotels.map((h) => h.lowestPrice)).toEqual([100, 200, null]);
  });

  it('PRICE_DESC sorts by lowestPrice descending, null last', async () => {
    const rows = [
      makeHotelRow({ id: 'h1', roomTypes: [{ id: 'rt-1', name: 'A', bedType: 'Q', capacity: 2, pricePerNight: 100, totalRooms: 5, isActive: true }] }),
      makeHotelRow({ id: 'h2', roomTypes: [] }),
      makeHotelRow({ id: 'h3', roomTypes: [{ id: 'rt-2', name: 'B', bedType: 'Q', capacity: 2, pricePerNight: 300, totalRooms: 5, isActive: true }] }),
    ];
    const service = buildService(rows);
    const result = await service.searchHotels({ sortBy: SortBy.PRICE_DESC });
    expect(result.hotels.map((h) => h.lowestPrice)).toEqual([300, 100, null]);
  });

  it('RATING sorts by rating descending, null last', async () => {
    const rows = [
      makeHotelRow({ id: 'h1', reviews: [{ overallRating: 3 }], _count: { reviews: 1 } }),
      makeHotelRow({ id: 'h2', reviews: [], _count: { reviews: 0 } }),
      makeHotelRow({ id: 'h3', reviews: [{ overallRating: 5 }], _count: { reviews: 1 } }),
    ];
    const service = buildService(rows);
    const result = await service.searchHotels({ sortBy: SortBy.RATING });
    expect(result.hotels.map((h) => h.id)).toEqual(['h3', 'h1', 'h2']);
  });

  it('RECOMMENDED (default) sorts by rating desc then reviewCount desc', async () => {
    const rows = [
      makeHotelRow({ id: 'h1', reviews: [{ overallRating: 4 }, { overallRating: 4 }], _count: { reviews: 2 } }),
      makeHotelRow({ id: 'h2', reviews: [], _count: { reviews: 0 } }),
      makeHotelRow({ id: 'h3', reviews: [{ overallRating: 4 }], _count: { reviews: 1 } }),
      makeHotelRow({ id: 'h4', reviews: [{ overallRating: 5 }], _count: { reviews: 1 } }),
    ];
    const service = buildService(rows);
    // no sortBy → defaults to RECOMMENDED: h4(5,1) → h1(4,2) → h3(4,1) → h2(null)
    const result = await service.searchHotels({});
    expect(result.hotels.map((h) => h.id)).toEqual(['h4', 'h1', 'h3', 'h2']);
  });
});

// ---------------------------------------------------------------------------
// searchHotels — Path A (no dates)
// ---------------------------------------------------------------------------

describe('SearchService — searchHotels Path A (no dates)', () => {
  it('returns paginated results with correct metadata', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => makeHotelRow({ id: `h${i}` }));
    const service = buildService(rows);
    const result = await service.searchHotels({ page: 2, limit: 5 });
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.hotels).toHaveLength(5);
  });

  it('filters by minRating', async () => {
    const rows = [
      makeHotelRow({ id: 'h1', reviews: [{ overallRating: 4 }], _count: { reviews: 1 } }),
      makeHotelRow({ id: 'h2', reviews: [], _count: { reviews: 0 } }),
      makeHotelRow({ id: 'h3', reviews: [{ overallRating: 2 }], _count: { reviews: 1 } }),
    ];
    const service = buildService(rows);
    const result = await service.searchHotels({ minRating: 3.5 });
    expect(result.hotels.map((h) => h.id)).toEqual(['h1']);
  });

  it('returns checkIn/checkOut as null when no dates supplied', async () => {
    const service = buildService([makeHotelRow()]);
    const result = await service.searchHotels({ city: 'Lagos' });
    expect(result.checkIn).toBeNull();
    expect(result.checkOut).toBeNull();
  });

  it('returns city from dto in response', async () => {
    const service = buildService([]);
    const result = await service.searchHotels({ city: 'Abuja' });
    expect(result.city).toBe('Abuja');
  });
});

// ---------------------------------------------------------------------------
// searchHotels — Path B (with dates)
// ---------------------------------------------------------------------------

describe('SearchService — searchHotels Path B (with dates)', () => {
  const checkIn = '2025-09-01';
  const checkOut = '2025-09-05';

  it('calls checkAvailability for each eligible room type', async () => {
    const hotelRow = makeHotelRow({
      roomTypes: [
        { id: 'rt-1', name: 'Standard', bedType: 'Queen', capacity: 2, pricePerNight: 100, totalRooms: 5, isActive: true },
        { id: 'rt-2', name: 'Deluxe', bedType: 'King', capacity: 4, pricePerNight: 200, totalRooms: 3, isActive: true },
      ],
    });
    const checkAvailability = vi.fn().mockResolvedValue({
      available: true,
      roomTypeId: 'rt-1',
      checkIn,
      checkOut,
      nights: 4,
      availableRooms: 3,
      pricePerNight: 120,
      totalPrice: 480,
      blockedDates: [],
    });
    const service = buildService([hotelRow], null, [], checkAvailability);

    await service.searchHotels({ checkIn, checkOut, guests: 2 });
    // guests=2 → both rt-1 (cap 2) and rt-2 (cap 4) are eligible
    expect(checkAvailability).toHaveBeenCalledTimes(2);
  });

  it('excludes hotels with no available rooms', async () => {
    const hotelRow = makeHotelRow({
      roomTypes: [
        { id: 'rt-1', name: 'Standard', bedType: 'Queen', capacity: 2, pricePerNight: 100, totalRooms: 5, isActive: true },
      ],
    });
    const checkAvailability = vi.fn().mockResolvedValue({
      available: false,
      roomTypeId: 'rt-1',
      checkIn,
      checkOut,
      nights: 4,
      availableRooms: 0,
      pricePerNight: 100,
      totalPrice: 0,
      blockedDates: ['2025-09-02'],
    });
    const service = buildService([hotelRow], null, [], checkAvailability);
    const result = await service.searchHotels({ checkIn, checkOut });
    expect(result.hotels).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('includes only rooms that pass the price filter', async () => {
    const hotelRow = makeHotelRow({
      roomTypes: [
        { id: 'rt-1', name: 'Cheap', bedType: 'Queen', capacity: 2, pricePerNight: 50, totalRooms: 5, isActive: true },
        { id: 'rt-2', name: 'Expensive', bedType: 'King', capacity: 2, pricePerNight: 300, totalRooms: 2, isActive: true },
      ],
    });
    const checkAvailability = vi.fn().mockImplementation(
      async (roomTypeId: string) => ({
        available: true,
        roomTypeId,
        checkIn,
        checkOut,
        nights: 4,
        availableRooms: 2,
        pricePerNight: roomTypeId === 'rt-1' ? 50 : 300,
        totalPrice: roomTypeId === 'rt-1' ? 200 : 1200,
        blockedDates: [],
      }),
    );
    const service = buildService([hotelRow], null, [], checkAvailability);
    const result = await service.searchHotels({ checkIn, checkOut, maxPrice: 100 });
    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0].availableRooms).toHaveLength(1);
    expect(result.hotels[0].availableRooms[0].roomTypeId).toBe('rt-1');
  });

  it('skips room types that do not meet guest capacity', async () => {
    const hotelRow = makeHotelRow({
      roomTypes: [
        { id: 'rt-1', name: 'Single', bedType: 'Twin', capacity: 1, pricePerNight: 80, totalRooms: 5, isActive: true },
        { id: 'rt-2', name: 'Suite', bedType: 'King', capacity: 3, pricePerNight: 200, totalRooms: 2, isActive: true },
      ],
    });
    const checkAvailability = vi.fn().mockResolvedValue({
      available: true,
      roomTypeId: 'rt-2',
      checkIn,
      checkOut,
      nights: 4,
      availableRooms: 2,
      pricePerNight: 200,
      totalPrice: 800,
      blockedDates: [],
    });
    const service = buildService([hotelRow], null, [], checkAvailability);

    await service.searchHotels({ checkIn, checkOut, guests: 2 });
    // Only rt-2 has capacity >= 2; rt-1 (capacity=1) should be skipped
    expect(checkAvailability).toHaveBeenCalledTimes(1);
    expect(checkAvailability).toHaveBeenCalledWith(
      'rt-2',
      expect.objectContaining({ checkIn, checkOut }),
    );
  });

  it('echoes checkIn/checkOut in the response', async () => {
    const service = buildService([]);
    const result = await service.searchHotels({ checkIn, checkOut });
    expect(result.checkIn).toBe(checkIn);
    expect(result.checkOut).toBe(checkOut);
  });
});

// ---------------------------------------------------------------------------
// getHotelDetail
// ---------------------------------------------------------------------------

describe('SearchService — getHotelDetail', () => {
  it('throws NotFoundException when hotel is not found', async () => {
    const service = buildService([], null);
    // NotFoundException is mocked above; just verify it throws
    await expect(service.getHotelDetail('nonexistent')).rejects.toThrow('Hotel not found: nonexistent');
  });

  it('returns all room types with available=true when no dates supplied', async () => {
    const hotelRow = {
      id: 'hotel-1',
      name: 'Test Hotel',
      slug: 'test-hotel',
      city: 'Lagos',
      state: 'Lagos',
      address: '1 Test St',
      description: null,
      images: [
        {
          id: 'img-1',
          url: 'http://img.test/1.jpg',
          isPrimary: true,
          hotelId: 'hotel-1',
          sortOrder: 0,
          createdAt: new Date(),
        },
      ],
      amenities: [{ amenity: { name: 'WiFi' } }],
      roomTypes: [
        { id: 'rt-1', name: 'Standard', bedType: 'Queen', capacity: 2, pricePerNight: 150, totalRooms: 5, isActive: true },
      ],
      reviews: [
        {
          overallRating: 4,
          title: 'Great',
          body: 'Loved it',
          createdAt: new Date(),
          user: { firstName: 'Alice', lastName: 'B' },
        },
      ],
      verification: null,
      _count: { reviews: 1 },
    };
    const service = buildService([], hotelRow);
    const result = await service.getHotelDetail('hotel-1');
    // Without dates, availableRooms shows all active room types with available=true
    expect(result.availableRooms).toHaveLength(1);
    expect(result.availableRooms[0].available).toBe(true);
    expect(result.availableRooms[0].availableRooms).toBe(5);
    expect(result.availableRooms[0].pricePerNight).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// getPopularCities
// ---------------------------------------------------------------------------

describe('SearchService — getPopularCities', () => {
  it('returns mapped city/state/hotelCount from groupBy', async () => {
    const groupByResult = [
      { city: 'Lagos', state: 'Lagos', _count: { id: 12 } },
      { city: 'Abuja', state: 'FCT', _count: { id: 8 } },
    ];
    const service = buildService([], null, groupByResult);
    const result = await service.getPopularCities();
    expect(result).toEqual([
      { city: 'Lagos', state: 'Lagos', hotelCount: 12 },
      { city: 'Abuja', state: 'FCT', hotelCount: 8 },
    ]);
  });
});
