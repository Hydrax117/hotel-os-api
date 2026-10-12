# Hotel OS API

> The NestJS backend for Hotel OS — a two-sided hospitality platform built for Nigeria and Africa.

## Architecture Overview

```
hotel-os (Next.js frontend)     → http://localhost:3000
hotel-os-api (NestJS backend)   → http://localhost:3001
```

The frontend and backend are separate repositories. The frontend currently uses mock data and is wired up module by module as each API module is completed.

## What is Hotel OS?

Hotel OS is a two-sided hospitality marketplace:

- **Hotel side** — Hotels register, go through a verification/approval process, then manage their inventory (room types, physical rooms, availability calendar), handle reservations, view occupancy analytics, and receive payouts.
- **Traveler side** — Travelers search for hotels by city/date/guests, view hotel and room detail pages, complete checkout, and manage their booking history.
- **Admin** — Platform administrators approve new hotel registrations, verify documentation, monitor platform-wide analytics, manage subscriptions, handle disputes, and oversee payouts.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 12 + TypeScript 6 (ESM modules) |
| Database | PostgreSQL + Prisma ORM |
| Queues | Redis + BullMQ (not yet implemented) |
| Auth | JWT — access token 15 min + refresh token 7 days |
| Payments | Paystack (not yet implemented) |
| Testing | Vitest |
| API Docs | Swagger / OpenAPI at `/api/docs` |

## Project Structure

```
hotel-os-api/
  src/
    auth/           ✅ Complete — register, login, refresh, logout, me
    users/          ✅ Complete — profile get/update
    prisma/         ✅ Complete — global PrismaService
    hotels/         ✅ Complete — CRUD, verification, admin approval
    rooms/          ✅ Complete — room types, physical rooms
    inventory/      ✅ Complete — date-based availability, holds, calendar
    search/         ✅ Complete — hotel search, availability filtering, popular cities, featured hotels
    bookings/       ✅ Complete — reservation state machine, temporary holds
    payments/       ✅ Complete — Paystack integration, webhooks, refunds
    reviews/        ✅ Complete — verified post-stay reviews, hotel responses, admin moderation
    subscriptions/  ✅ Complete — plan management, billing cycles, grace period, admin suspend/reactivate
    notifications/  ⬜ Pending
    admin/          ⬜ Pending
    common/
      utils/        Shared utilities (slug generation, etc.)
  prisma/
    schema.prisma   ✅ Complete — all 16 models defined
    migrations/     Database migration history
  test/             E2E tests
```

## Database Schema

All 16 Prisma models and their purpose:

| Model | Description |
|---|---|
| `User` | Platform users — travelers, hotel owners, hotel staff, admins |
| `RefreshToken` | JWT refresh tokens stored hashed for rotation |
| `Hotel` | Core hotel entity — details, location, verification status, subscription plan |
| `HotelVerification` | Admin review record for hotel approval/rejection |
| `HotelStaff` | Hotel team members linked to a hotel (managers, receptionists, staff) |
| `HotelImage` | Hotel photo gallery with primary image flag |
| `Amenity` | Platform amenity catalogue (WiFi, Pool, Gym, etc.) |
| `HotelAmenity` | Many-to-many join between Hotel and Amenity |
| `RoomType` | Room categories within a hotel (Deluxe King, Standard Twin, etc.) |
| `Room` | Individual physical rooms, each assigned to a RoomType |
| `InventoryDay` | Per-date availability tracking — held/booked unit counts and price overrides |
| `Booking` | Guest reservation — links user, hotel, room type; includes all guest and pricing details |
| `Payment` | Paystack payment record for a booking, including commission split |
| `Refund` | Refund record linked to a payment |
| `Subscription` | Hotel subscription billing record (plan, status, billing cycle) |
| `Payout` | Hotel payout batches, made up of PayoutItems |
| `PayoutItem` | Individual payment included in a payout batch |
| `Review` | Verified post-stay review with 6 rating dimensions and hotel response |

## Current API Endpoints

Base URL: `http://localhost:3001/api/v1`

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register a new user |
| POST | `/auth/login` | None | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | None | Exchange refresh token for new token pair |
| POST | `/auth/logout` | Bearer | Invalidate all refresh tokens for the user |
| GET | `/auth/me` | Bearer | Get the currently authenticated user |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/profile` | Bearer | Get the authenticated user's profile |
| PATCH | `/users/profile` | Bearer | Update the authenticated user's profile |

### Hotels

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hotels` | None | List approved published hotels (paginated, filterable) |
| GET | `/hotels/my` | HOTEL_OWNER | Get the owner's hotel |
| GET | `/hotels/admin/pending` | SUPER_ADMIN | List hotels pending verification |
| GET | `/hotels/:id` | None | Get a hotel by ID |
| GET | `/hotels/slug/:slug` | None | Get a hotel by slug (for public detail pages) |
| POST | `/hotels` | HOTEL_OWNER | Create a new hotel (one per owner) |
| PATCH | `/hotels/:id` | HOTEL_OWNER | Update hotel details |
| PATCH | `/hotels/:id/verify` | SUPER_ADMIN | Approve, reject, or suspend a hotel |

### Rooms

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hotels/:hotelId/room-types` | None | List all room types for a hotel |
| POST | `/hotels/:hotelId/room-types` | HOTEL_OWNER | Create a room type |
| GET | `/hotels/:hotelId/room-types/:id` | None | Get a room type by ID |
| PATCH | `/hotels/:hotelId/room-types/:id` | HOTEL_OWNER | Update a room type |
| DELETE | `/hotels/:hotelId/room-types/:id` | HOTEL_OWNER | Delete a room type (no active bookings) |
| GET | `/hotels/:hotelId/room-types/:id/rooms` | HOTEL_OWNER | List physical rooms in a room type |
| POST | `/hotels/:hotelId/room-types/:id/rooms` | HOTEL_OWNER | Add a physical room |
| PATCH | `/hotels/:hotelId/room-types/:id/rooms/:roomId/status` | HOTEL_OWNER | Update room status |
| DELETE | `/hotels/:hotelId/room-types/:id/rooms/:roomId` | HOTEL_OWNER | Delete a physical room |

### Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/room-types/:roomTypeId/inventory/availability` | None | Check availability for a date range |
| GET | `/room-types/:roomTypeId/inventory/calendar` | None | Get inventory calendar |
| PATCH | `/room-types/:roomTypeId/inventory/day` | HOTEL_OWNER | Update a single inventory day |
| PATCH | `/room-types/:roomTypeId/inventory/bulk` | HOTEL_OWNER | Bulk update inventory over a date range |
| POST | `/room-types/:roomTypeId/inventory/ensure` | HOTEL_OWNER | Pre-populate inventory days |

### Search

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search/hotels` | None | Search approved hotels — optional date availability filtering |
| GET | `/search/hotels/:idOrSlug` | None | Get full hotel detail by id or slug, optional availability check |
| GET | `/search/popular-cities` | None | Get top 10 cities ranked by hotel count |
| GET | `/search/featured` | None | Get featured hotels (highest review count) |

**Search query params**: `city`, `state`, `q` (name), `checkIn`, `checkOut`, `guests`, `minPrice`, `maxPrice`, `minRating`, `amenities[]`, `sortBy` (recommended|price_asc|price_desc|rating), `page`, `limit`.

### Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reviews` | Bearer | Create a review (only for CHECKED_OUT bookings) |
| GET | `/reviews/my` | Bearer | List all reviews written by the authenticated user |
| GET | `/reviews/:id` | None | Get a review by ID |
| POST | `/reviews/:id/respond` | Bearer (hotel owner) | Add a hotel response to a review |
| PATCH | `/reviews/:id/approve` | SUPER_ADMIN | Approve a review |
| PATCH | `/reviews/:id/flag` | SUPER_ADMIN | Flag a review for moderation |
| DELETE | `/reviews/:id` | SUPER_ADMIN | Delete a review |
| GET | `/hotels/:hotelId/reviews` | None | List reviews for a hotel (paginated, filterable by rating/approval) |

### Subscriptions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/subscriptions/plans` | None | List all available subscription plans and pricing |
| POST | `/subscriptions/hotels/:hotelId` | HOTEL_OWNER | Subscribe a hotel to a plan |
| GET | `/subscriptions/hotels/:hotelId` | HOTEL_OWNER | Get the current subscription for a hotel |
| PATCH | `/subscriptions/hotels/:hotelId/plan` | HOTEL_OWNER | Change the subscription plan |
| DELETE | `/subscriptions/hotels/:hotelId` | HOTEL_OWNER | Cancel (archive) the subscription |
| POST | `/subscriptions/hotels/:hotelId/suspend` | SUPER_ADMIN | Suspend a hotel's subscription (unpublishes hotel) |
| POST | `/subscriptions/hotels/:hotelId/reactivate` | SUPER_ADMIN | Reactivate a suspended subscription (republishes hotel) |

**Subscription plans (NGN/month):**
- `STARTER` — ₦25,000/month: Hotel listing, basic dashboard, bookings, inventory
- `PROFESSIONAL` — ₦50,000/month: Everything in Starter + analytics, staff accounts, advanced inventory, promotions
- `ENTERPRISE` — ₦150,000/month: Everything in Professional + API integration, multi-property support, advanced reporting, dedicated support

**Subscription lifecycle:**
1. Hotel owner subscribes → status `ACTIVE`, `nextBilling` set 1 month out.
2. If billing lapses → status moves to `GRACE_PERIOD` (7-day window via `checkExpiredSubscriptions` cron).
3. After grace period ends → status `SUSPENDED`, hotel unpublished.
4. Admin can `reactivate` → status back to `ACTIVE`, hotel republished.
5. Owner can cancel at any time → status `ARCHIVED`.

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/webhook` | None | Paystack webhook receiver (raw body) |
| POST | `/payments/initialize` | Bearer | Initialize a Paystack payment for a booking |
| GET | `/payments/verify/:reference` | Bearer | Verify a payment reference with Paystack |
| GET | `/payments/booking/:bookingId` | Bearer | Get payment record for a booking |
| GET | `/payments/hotel/:hotelId` | HOTEL_OWNER | List all payments for a hotel's bookings |
| POST | `/payments/:paymentId/refund` | Bearer | Issue a refund for a successful payment |

**Payment flow:**
1. Guest creates a booking (`POST /bookings`) — booking enters `HELD` status with 10-min hold.
2. Guest initializes payment (`POST /payments/initialize`) — returns a Paystack authorization URL. Booking moves to `PAYMENT_PENDING`.
3. Guest completes payment on Paystack-hosted page.
4. Paystack sends `charge.success` webhook (`POST /payments/webhook`) — payment confirmed, booking moves to `CONFIRMED`.
5. Guest can also verify manually (`GET /payments/verify/:reference`) — idempotent, safe to call multiple times.

### Bookings

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Bearer | Create a booking (HELD status, 10-min hold) |
| GET | `/bookings` | Bearer | List the authenticated user's bookings (paginated) |
| GET | `/bookings/hotel/:hotelId` | HOTEL_OWNER | List all bookings for a hotel |
| GET | `/bookings/:id` | Bearer | Get a booking by ID |
| POST | `/bookings/:id/cancel` | Bearer | Cancel a booking |
| POST | `/bookings/:id/confirm` | Bearer | Confirm a booking (test endpoint — will be replaced by payment webhook) |
| PATCH | `/bookings/:id/status` | HOTEL_OWNER/STAFF | Update booking status (check-in, check-out, no-show) |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional for now — required when queues are implemented)

### Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd hotel-os-api
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and the JWT secrets

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Start the dev server (watches for changes)
npm run start:dev

# 5. Open Swagger API docs
open http://localhost:3001/api/docs
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/hotel_os_dev` |
| `JWT_SECRET` | Secret for signing access tokens | Any long random string |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (different from JWT_SECRET) | Any long random string |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `PORT` | Port the API server listens on | `3001` |
| `NODE_ENV` | Environment flag | `development` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | `sk_test_xxx` |
| `PLATFORM_COMMISSION_RATE` | Platform commission rate (decimal) | `0.1` |

## Development Workflow

Each module follows this build pattern:

1. **Schema change** — If the module needs new fields or models, write a Prisma migration:
   ```bash
   npx prisma migrate dev --name add-<feature>
   ```
2. **Service** — Write the business logic in `src/<module>/<module>.service.ts`. Inject `PrismaService` and `ConfigService`. No HTTP concerns here.
3. **Controller** — Expose HTTP endpoints in `src/<module>/<module>.controller.ts`. Use guards and decorators.
4. **Module** — Wire everything in `src/<module>/<module>.module.ts` and add the module to `AppModule`.
5. **Swagger** — Test the new endpoints at `http://localhost:3001/api/docs`.
6. **Frontend wiring** — Update the corresponding Next.js page to call the real API endpoint instead of importing mock data.
7. **Remove mock** — Delete or archive the `mock.ts` file from the frontend page directory.

## Module Build Order (Roadmap)

Modules must be built in dependency order. A module that depends on another (e.g. Bookings depends on Inventory, Rooms, and Hotels) should not be started until its dependencies are complete.

```
✅ Auth module        — JWT auth, roles, refresh tokens
✅ Users module       — profile management  
✅ Hotels module      — hotel CRUD, verification, admin approval
✅ Rooms module       — room types, physical rooms
✅ Inventory module   — date-based availability, holds, calendar
✅ Search module      — availability search (traveler-facing)
✅ Bookings module    — reservation state machine, temporary holds
✅ Payments module    — Paystack integration, webhooks, refunds
✅ Reviews module     — verified post-stay reviews, hotel responses, admin moderation
✅ Subscriptions      — plan management, billing cycles, grace period, admin suspend/reactivate
🔄 Notifications      — email and WhatsApp delivery via BullMQ (Next)
⬜ Admin module       — platform management endpoints
```

## Key Patterns

### ESM imports
This project uses ESM modules. All relative imports **must** include the `.js` extension — TypeScript resolves `.ts` files but Node/ESM requires `.js` at runtime:

```ts
// ✅ Correct
import { HotelsService } from './hotels.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// ❌ Wrong — will fail at runtime
import { HotelsService } from './hotels.service';
```

### DTOs and validation
All request bodies are typed with DTOs using `class-validator` decorators:

```ts
export class CreateHotelDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
```

### Auth guards

```ts
// Any authenticated user
@UseGuards(JwtAuthGuard)

// Specific role required
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
```

### Current user

```ts
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: JwtUser) {
  return this.usersService.findById(user.userId);
}
```

### PrismaModule
`PrismaModule` is globally registered — inject `PrismaService` directly in any service constructor without adding it to `imports`.

### Config
Always use `ConfigService`, never `process.env` directly:

```ts
constructor(private configService: ConfigService) {}

// Later:
const secret = this.configService.get<string>('JWT_SECRET');
```

## Frontend Integration

The Next.js frontend at `hotel-os/` currently uses mock data files (e.g. `app/hotels/mock.ts`). As each backend module is completed, the frontend page is updated to call the real API:

```ts
// Before — mock data
import { SEARCH_MOCK_HOTELS } from '../mock';
const hotels = SEARCH_MOCK_HOTELS;

// After — real API
const response = await fetch('http://localhost:3001/api/v1/hotels?city=Lagos');
const { hotels } = await response.json();
```

The frontend and backend are developed in parallel. Completing a backend module unlocks the frontend wiring task for that module.

## Testing

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # end-to-end tests
npm run test:cov      # coverage report
```

## API Documentation

Swagger UI is available at `http://localhost:3001/api/docs` when the server is running. All endpoints are documented with request/response shapes.
