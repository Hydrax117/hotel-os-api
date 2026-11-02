# 🚀 How to Run the E2E Tests

## What You Need

Before running tests, make sure you have:

1. **PostgreSQL** running
2. **Redis** running on port 6379
3. **Node.js** v18+ installed
4. **npm** installed

## One-Minute Setup

### Step 1: Start Services

**Option A - Docker (Recommended)**
```bash
# PostgreSQL
docker run -d --name pg-hotel -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:latest

# Redis
docker run -d --name redis-hotel -p 6379:6379 redis:latest
```

**Option B - Local Installation**
```bash
# Windows
redis-server
pg_ctl -D "C:\Program Files\PostgreSQL\data" start

# Linux/Mac
redis-server
# PostgreSQL usually auto-starts or: pg_ctl -D /usr/local/var/postgres start
```

### Step 2: Setup Project

```bash
# Install dependencies (first time only)
npm install

# Apply database migrations (first time or after schema changes)
npx prisma migrate deploy

# (Optional) Reset database if needed
# npx prisma db drop
# npx prisma migrate deploy
```

### Step 3: Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Or run quick test suite (faster, good for development)
npm run test:e2e -- test/endpoints.e2e-spec.ts

# Watch mode (reruns when you save files)
npm run test:watch

# Generate coverage report
npm run test:cov
```

## Expected Output

### Successful Run ✅
```
✓ test/endpoints.e2e-spec.ts (48 tests | 48 passed) 12500ms

Test Files 1 passed (1)
     Tests 48 passed (48)
  Start at 14:30:00
  Duration 12.50s
```

### If Something Fails ❌
```
✗ POST /auth/login - should login user
  AssertionError: expected 401 to equal 200
```

See **Troubleshooting** section below.

## Running Specific Tests

```bash
# Only Auth tests
npm run test:e2e -- -t "Auth"

# Only Hotels tests
npm run test:e2e -- -t "Hotels"

# One specific test
npm run test:e2e -- -t "should create hotel as owner"

# Run comprehensive suite (slower but complete)
npm run test:e2e -- test/api.e2e-spec.ts
```

## Test Files Available

### `test/endpoints.e2e-spec.ts` - Quick Version ⚡
```
48 tests covering main endpoints
Runs in ~12-15 seconds
Great for development and CI/CD
```

### `test/api.e2e-spec.ts` - Comprehensive Version 📚
```
104+ tests covering all scenarios
Runs in ~30-40 seconds
Full coverage with error cases
```

## Troubleshooting

### ❌ Error: Redis Connection Refused
```
Error: connect ECONNREFUSED ::1:6379
```

**Fix**: Start Redis
```bash
redis-server          # Windows/Linux/Mac
# OR
docker run -d -p 6379:6379 redis:latest
```

### ❌ Error: PostgreSQL Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix**: Start PostgreSQL and verify `.env` DATABASE_URL
```bash
# Check .env has correct DATABASE_URL
cat .env | grep DATABASE_URL

# Start PostgreSQL
pg_ctl -D "path-to-data" start

# OR use Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:latest
```

### ❌ Error: Migration Not Applied
```
Error: relation "users" does not exist
```

**Fix**: Run migrations
```bash
npx prisma migrate deploy

# OR reset and re-apply (⚠️ deletes all data)
npx prisma db drop
npx prisma migrate deploy
```

### ❌ Error: Tests Hang/Timeout
```
Command timed out after 120000ms
```

**Fix**: Check services are responsive
```bash
# Verify PostgreSQL
psql -U postgres -d postgres -c "SELECT 1"

# Verify Redis
redis-cli ping        # Should return PONG

# If tests are still slow, run quick suite
npm run test:e2e -- test/endpoints.e2e-spec.ts
```

### ⚠️ Warning: Unknown Option
```
Error: invalid option '-t'
```

**Fix**: Correct vitest syntax
```bash
# Correct way
npm run test:e2e -- -t "pattern"

# Not like this
npm run test:e2e -t "pattern"
```

## Common Workflows

### 👨‍💻 Development: Quick Test & Fix Loop
```bash
# Start watch mode (reruns on changes)
npm run test:watch

# Edit code, tests automatically rerun
# See results immediately

# Run specific test while developing
npm run test:e2e -- -t "Auth"
```

### 🔍 Pre-Commit: Verify Nothing Broke
```bash
# Run quick suite to verify
npm run test:e2e -- test/endpoints.e2e-spec.ts

# If passes, safe to commit
```

### 🚀 Before Release: Full Validation
```bash
# Run comprehensive tests
npm run test:e2e

# Generate coverage report
npm run test:cov

# All tests pass? Good to deploy!
```

### 🐛 Debugging Failed Test
```bash
# Run with verbose output
npm run test:e2e -- -t "failing test name" --reporter=verbose

# See exactly what assertion failed
```

## Test Output Explained

### ✓ (Checkmark) = Test Passed
```
✓ should create hotel as owner (1230ms)
```

### ✗ (X) = Test Failed
```
✗ should reject hotel creation by guest (1230ms)
  AssertionError: expected 403 to equal 403
```

### ⊙ (Circle) = Test Skipped
```
⊙ should test optional feature (pending)
```

## Performance Tips

### Make Tests Faster

1. **Run quick suite only** (48 tests vs 104+)
   ```bash
   npm run test:e2e -- test/endpoints.e2e-spec.ts
   ```

2. **Run specific tests** instead of all
   ```bash
   npm run test:e2e -- -t "Auth"
   ```

3. **Use watch mode** during development
   ```bash
   npm run test:watch
   ```

4. **Check service health**
   ```bash
   redis-cli ping     # Should return PONG
   psql -c "SELECT 1" # Should work
   ```

## Interpreting Results

### All Tests Pass ✅
```
✓ 48 tests passed
Ready to commit/deploy
```

### Some Tests Fail ⚠️
```
✗ 3 tests failed
Need to fix endpoint
See error message for details
```

### Services Not Running ❌
```
ECONNREFUSED errors
Start PostgreSQL and Redis
See Troubleshooting section
```

## Test Structure

### What Gets Tested
- **Auth**: Login, register, refresh, logout
- **Users**: Profile get/update
- **Hotels**: Full CRUD, publish, admin approval, images, documents
- **Rooms**: Room types and physical rooms management
- **Bookings**: Create, cancel, confirm, status updates
- **Search**: Hotel search with filters, popular cities, featured
- **Reviews**: Create, approve, flag, delete
- **Admin**: Stats, revenue, user/hotel management
- **Applications**: Submit, approve, reject
- **Authorization**: Role-based access control, user isolation

### How Tests Work
1. Clear database (fresh state)
2. Create test users (admin, owner, guest)
3. Test each endpoint with valid/invalid data
4. Verify correct status codes and responses
5. Verify authorization checks work
6. Clean up database

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all tests |
| `npm run test:e2e -- test/endpoints.e2e-spec.ts` | Run quick tests |
| `npm run test:watch` | Watch mode (auto-rerun) |
| `npm run test:cov` | Coverage report |
| `npm run test:debug` | Debug mode |
| `npm run build` | Verify code compiles |

## Getting Help

1. **Can't get services running?**
   - See Troubleshooting section above

2. **Don't understand test output?**
   - See "Test Output Explained" section

3. **Need more info about testing?**
   - Read `TESTING.md` (comprehensive guide)
   - Read `TEST_SUMMARY.md` (quick reference)

4. **Want to add new tests?**
   - Look at `test/endpoints.e2e-spec.ts` for simple examples
   - Look at `test/api.e2e-spec.ts` for detailed patterns

## Success! 🎉

When all tests pass:
- ✅ All endpoints working correctly
- ✅ Authorization enforced properly
- ✅ Error handling in place
- ✅ Data validation working
- ✅ Ready to deploy

```
Test Files 1 passed (1)
     Tests 48 passed (48)
```

You're all set! 🚀
