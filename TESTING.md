# Testing Guide - Hotel OS API

## Quick Start

### Prerequisites

Before running tests, ensure you have:

1. **Node.js & npm** - Project dependencies
2. **PostgreSQL** - Running and configured in `.env` as `DATABASE_URL`
3. **Redis** - Running on localhost:6379 (for BullMQ queues)
4. **Database Migrations** - Applied via Prisma

### Start Services

#### Windows

**PowerShell:**
```powershell
# Start PostgreSQL (if using local installation)
pg_ctl -D "C:\Program Files\PostgreSQL\data" start

# Start Redis (if using local installation)
redis-server
```

**Or using Docker:**
```bash
# PostgreSQL
docker run -d --name postgres-hotel -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:latest

# Redis
docker run -d --name redis-hotel -p 6379:6379 redis:latest
```

### Setup Database

```bash
# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- test/endpoints.e2e-spec.ts

# Run with watch mode (reruns on file changes)
npm run test:watch

# Run with coverage report
npm run test:cov

# Run in debug mode
npm run test:debug
```

## Test Files

### `test/api.e2e-spec.ts` (Comprehensive)
- **Size**: 1,200+ lines
- **Tests**: 104+ test cases
- **Coverage**: All endpoints with detailed scenarios
- **Best for**: Full test coverage validation
- **Run**: `npm run test:e2e`

### `test/endpoints.e2e-spec.ts` (Quick Verification)
- **Size**: 500+ lines
- **Tests**: 48 test cases
- **Coverage**: Major endpoints and happy paths
- **Best for**: Quick local testing and CI/CD
- **Run**: `npm run test:e2e -- test/endpoints.e2e-spec.ts`

### `test/app.e2e-spec.ts` (Basic Sanity Check)
- **Size**: Small
- **Tests**: 1 basic test
- **Coverage**: Root endpoint only
- **Best for**: Server health check

## Test Organization

Tests are organized by module:

```
├── Auth Endpoints
│   ├── Register
│   ├── Login
│   ├── Refresh Token
│   ├── Logout
│   └── Get Current User
├── Users Endpoints
│   ├── Get Profile
│   └── Update Profile
├── Hotels Endpoints
│   ├── CRUD Operations
│   ├── Publish/Unpublish
│   ├── Admin Verification
│   ├── Image Management
│   └── Document Management
├── Rooms Endpoints
│   ├── Room Type Management
│   └── Physical Room Management
├── Search Endpoints
├── Bookings Endpoints
├── Reviews Endpoints
├── Admin Endpoints
├── Hotel Applications Endpoints
└── Authorization & Access Control
```

## Understanding Test Results

### Successful Run
```
✓ test/endpoints.e2e-spec.ts (48 tests | 48 passed) 12500ms

Test Files 1 passed (1)
     Tests 48 passed (48)
  Start at 14:30:00
  Duration 12.50s
```

### Failed Test
```
✗ POST /auth/login - should login user (1230ms)
  AssertionError: expected 200 to equal 200
    at Context.<anonymous> (test/endpoints.e2e-spec.ts:145:15)
```

### Debugging Tips

1. **View detailed error output**
   ```bash
   npm run test:e2e -- --reporter=verbose
   ```

2. **Run single test**
   ```bash
   npm run test:e2e -- -t "should login user"
   ```

3. **Check specific test file**
   ```bash
   npm run test:e2e -- test/endpoints.e2e-spec.ts --reporter=verbose
   ```

4. **Enable debug logging**
   ```bash
   DEBUG=* npm run test:e2e
   ```

## Common Issues & Solutions

### Issue: Redis Connection Refused
```
Error: connect ECONNREFUSED ::1:6379
```

**Solution**: Start Redis
```bash
# Windows
redis-server

# Linux/Mac
redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

### Issue: Database Connection Failed
```
Error: Connect timeout exceeded
```

**Solution**: 
- Verify PostgreSQL is running
- Check `.env` DATABASE_URL is correct
- Run migrations: `npx prisma migrate deploy`
- Test connection: `psql <DATABASE_URL>`

### Issue: Migration Errors
```
Error: Migration loop detected
```

**Solution**:
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or manually:
npx prisma db drop
npx prisma migrate deploy
```

### Issue: Tests Timeout After 120 Seconds
**Solution**:
- Ensure database is responsive
- Check for slow queries
- Verify no deadlocks in database
- Try with fewer tests first

### Issue: Port Already in Use
```
Error: listen EADDRINUSE :::3001
```

**Solution**: Kill process on port 3001
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3001
kill -9 <PID>
```

## Test Coverage Goals

| Module | Coverage | Status |
|--------|----------|--------|
| Auth | 85% | ✅ |
| Users | 90% | ✅ |
| Hotels | 80% | ✅ |
| Rooms | 80% | ✅ |
| Bookings | 85% | ✅ |
| Search | 90% | ✅ |
| Reviews | 85% | ✅ |
| Admin | 80% | ✅ |
| Applications | 85% | ✅ |

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:e2e
```

## Performance Optimization

### Reduce Test Execution Time

1. **Run tests in parallel** (already enabled in vitest)
   ```bash
   npm run test:e2e -- --threads
   ```

2. **Use focused tests** during development
   ```bash
   npm run test:e2e -- -t "Auth"
   ```

3. **Cache database state** (if safe)
   - Use snapshots for static data
   - Avoid full TRUNCATE if possible

4. **Profile slow tests**
   ```bash
   npm run test:e2e -- --reporter=verbose
   ```

## Best Practices

### Writing New Tests

```typescript
describe('New Feature', () => {
  let testData;

  beforeEach(async () => {
    // Setup: Create test data
    testData = await createTestData();
  });

  it('should do something', async () => {
    // Arrange
    const input = { /* test input */ };
    
    // Act
    const response = await request(app.getHttpServer())
      .post('/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send(input);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ /* expected data */ });
  });
});
```

### Test Naming Convention

```typescript
// ✅ Good: Clear, specific, states the condition and expectation
it('should return 401 when login with invalid password', async () => {});

// ❌ Bad: Vague, unclear what's being tested
it('should handle login', async () => {});

// ✅ Good: Describes role restriction
it('should reject hotel creation by guest user', async () => {});

// ❌ Bad: Missing context
it('should reject creation', async () => {});
```

### Test Data Management

```typescript
// ✅ Good: Isolated test data, no side effects
beforeEach(async () => {
  await clearDatabase();
  testUser = await createUser('test@test.com', UserRole.GUEST);
});

// ❌ Bad: Shared mutable state, test interference
const sharedUser = createUser('shared@test.com', UserRole.GUEST);
```

## Maintenance

- Review and update tests when endpoints change
- Add tests for new features before implementation
- Monitor test execution time
- Update documentation with new endpoints
- Keep test utilities and helpers up to date
- Archive old/deprecated test cases

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
