import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole } from '@prisma/client';

describe('Hotel OS API Endpoints - E2E Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let ownerToken: string;
  let guestToken: string;
  let adminId: string;
  let ownerId: string;
  let guestId: string;
  let hotelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clear and setup test data
    await clearDatabase();
    
    // Create admin user directly in database (can't register SUPER_ADMIN via API)
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash: await import('bcryptjs').then(bc => bc.hash('TestPassword123!', 12)),
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.SUPER_ADMIN,
      },
    });
    adminId = adminUser.id;

    // Login to get admin token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'TestPassword123!',
      });
    adminToken = loginRes.body.accessToken;

    // Register owner and guest through API (allowed roles)
    const ownerRes = await createUser('owner@test.com', UserRole.HOTEL_OWNER);
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    const guestRes = await createUser('guest@test.com', UserRole.TRAVELER);
    guestToken = guestRes.body.accessToken;
    guestId = guestRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function clearDatabase() {
    const tables = [
      'bookings',
      'reviews',
      'hotel_documents',
      'hotel_images',
      'rooms',
      'room_types',
      'hotel_applications',
      'hotels',
      'user_sessions',
      'users',
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (e) {
        // Table might not exist
      }
    }
  }

  async function createUser(email: string, role: UserRole) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        role,
      });
    
    if (res.status !== 201) {
      console.error('Register failed:', res.status, res.body);
      throw new Error(`Registration failed: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    
    return res;
  }

  describe('Auth Endpoints', () => {
    it('POST /auth/register - should register user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'TestPassword123!',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.GUEST,
        });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('POST /auth/login - should login user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'guest@test.com',
          password: 'TestPassword123!',
        });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('GET /auth/me - should return current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBeDefined();
    });

    it('GET /auth/me - should reject without token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Users Endpoints', () => {
    it('GET /users/profile - should get user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(guestId);
    });

    it('PATCH /users/profile - should update profile', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });
      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Updated');
    });
  });

  describe('Hotels Endpoints', () => {
    it('POST /hotels - should create hotel as owner', async () => {
      const res = await request(app.getHttpServer())
        .post('/hotels')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Hotel',
          description: 'A test hotel',
          address: '123 Main St',
          city: 'Test City',
          state: 'TS',
          country: 'TC',
          zipCode: '12345',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Hotel');
      hotelId = res.body.id;
    });

    it('GET /hotels - should list hotels', async () => {
      const res = await request(app.getHttpServer()).get('/hotels');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /hotels/:id - should get hotel by ID', async () => {
      const res = await request(app.getHttpServer()).get(`/hotels/${hotelId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(hotelId);
    });

    it('GET /hotels/my - should get owner hotel', async () => {
      const res = await request(app.getHttpServer())
        .get('/hotels/my')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(hotelId);
    });

    it('PATCH /hotels/:id - should update hotel', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/hotels/${hotelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          description: 'Updated description',
        });
      expect(res.status).toBe(200);
    });

    it('PATCH /hotels/:id/publish - should publish hotel', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/hotels/${hotelId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.published).toBe(true);
    });

    it('PATCH /hotels/:id/verify - should approve hotel as admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/hotels/${hotelId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });
      expect(res.status).toBe(200);
    });

    it('POST /hotels/:id/images - should add image', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hotels/${hotelId}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          url: 'https://example.com/image.jpg',
          caption: 'Hotel lobby',
        });
      expect(res.status).toBe(201);
    });

    it('GET /hotels/:id/images - should get images', async () => {
      const res = await request(app.getHttpServer())
        .get(`/hotels/${hotelId}/images`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /hotels/:id/documents - should save document', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hotels/${hotelId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'BUSINESS_LICENSE',
          url: 'https://example.com/license.pdf',
          issuedDate: '2024-01-01',
          expiryDate: '2025-01-01',
        });
      expect(res.status).toBe(201);
    });

    it('GET /hotels/:id/documents - should get documents', async () => {
      const res = await request(app.getHttpServer())
        .get(`/hotels/${hotelId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Rooms Endpoints', () => {
    let roomTypeId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post(`/hotels/${hotelId}/room-types`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Deluxe Suite',
          description: 'Luxury room',
          basePrice: 200,
          maxGuests: 2,
        });
      roomTypeId = res.body.id;
    });

    it('POST /hotels/:hotelId/room-types - should create room type', async () => {
      expect(roomTypeId).toBeDefined();
    });

    it('GET /hotels/:hotelId/room-types - should list room types', async () => {
      const res = await request(app.getHttpServer()).get(
        `/hotels/${hotelId}/room-types`
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /hotels/:hotelId/room-types/:id - should get room type by ID', async () => {
      const res = await request(app.getHttpServer()).get(
        `/hotels/${hotelId}/room-types/${roomTypeId}`
      );
      expect(res.status).toBe(200);
    });

    it('PATCH /hotels/:hotelId/room-types/:id - should update room type', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/hotels/${hotelId}/room-types/${roomTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          basePrice: 250,
        });
      expect(res.status).toBe(200);
    });

    it('POST /hotels/:hotelId/room-types/:id/rooms - should create room', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hotels/${hotelId}/room-types/${roomTypeId}/rooms`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          roomNumber: '101',
        });
      expect(res.status).toBe(201);
    });

    it('GET /hotels/:hotelId/room-types/:id/rooms - should list rooms', async () => {
      const res = await request(app.getHttpServer())
        .get(`/hotels/${hotelId}/room-types/${roomTypeId}/rooms`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Search Endpoints', () => {
    it('GET /search/hotels - should search hotels', async () => {
      const res = await request(app.getHttpServer()).get('/search/hotels');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /search/popular-cities - should get popular cities', async () => {
      const res = await request(app.getHttpServer()).get(
        '/search/popular-cities'
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /search/featured - should get featured hotels', async () => {
      const res = await request(app.getHttpServer()).get('/search/featured');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /search/hotels/:idOrSlug - should get hotel detail', async () => {
      const res = await request(app.getHttpServer()).get(
        `/search/hotels/${hotelId}`
      );
      expect(res.status).toBe(200);
    });
  });

  describe('Admin Endpoints', () => {
    it('GET /admin/stats - should get platform stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /admin/revenue - should get revenue stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
        });
      expect(res.status).toBe(200);
    });

    it('GET /admin/hotels - should list hotels as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/hotels')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /admin/users - should list users as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /admin/bookings - should list bookings as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject admin endpoints without admin auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Reviews Endpoints', () => {
    let reviewId: string;

    it('POST /reviews - should create review', async () => {
      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          hotelId,
          rating: 5,
          title: 'Great hotel!',
          comment: 'Amazing experience!',
        });
      expect(res.status).toBe(201);
      reviewId = res.body.id;
    });

    it('GET /reviews/my - should get user reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/reviews/my')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /reviews/:id - should get review by ID', async () => {
      const res = await request(app.getHttpServer()).get(
        `/reviews/${reviewId}`
      );
      expect(res.status).toBe(200);
    });

    it('PATCH /reviews/:id/approve - should approve review as admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Hotel Applications Endpoints', () => {
    let appId: string;

    it('POST /hotel-applications - should submit application', async () => {
      const res = await request(app.getHttpServer())
        .post('/hotel-applications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          hotelName: 'My Hotel',
          description: 'A beautiful hotel',
          address: '123 Main St',
          city: 'Test City',
          state: 'TS',
          country: 'TC',
          zipCode: '12345',
          ownerName: 'John Doe',
          phone: '+1234567890',
        });
      expect(res.status).toBe(201);
      appId = res.body.id;
    });

    it('GET /hotel-applications/my - should get own application', async () => {
      const res = await request(app.getHttpServer())
        .get('/hotel-applications/my')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /hotel-applications - should list applications as admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/hotel-applications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Bookings Endpoints', () => {
    let roomTypeId: string;
    let bookingId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post(`/hotels/${hotelId}/room-types`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Standard Room',
          description: 'Standard room',
          basePrice: 100,
          maxGuests: 2,
        });
      roomTypeId = res.body.id;
    });

    it('POST /bookings - should create booking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + 3);

      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomTypeId,
          hotelId,
          checkInDate: tomorrow.toISOString().split('T')[0],
          checkOutDate: checkOut.toISOString().split('T')[0],
          guests: 1,
          totalPrice: 200,
        });
      expect(res.status).toBe(201);
      bookingId = res.body.id;
    });

    it('GET /bookings - should get user bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /bookings/:id - should get booking by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /bookings/:id/confirm - should confirm booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Authorization & Access Control', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const res = await request(app.getHttpServer()).get('/users/profile');
      expect(res.status).toBe(401);
    });

    it('should reject guest from creating hotel', async () => {
      const res = await request(app.getHttpServer())
        .post('/hotels')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          name: 'Test Hotel',
          city: 'Test',
          state: 'TS',
          country: 'TC',
        });
      expect(res.status).toBe(403);
    });

    it('should reject guest from admin endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject invalid tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });
});
