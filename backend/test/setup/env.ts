/**
 * Loaded via jest's `setupFiles` (test/jest-e2e.json) — runs before any
 * test file (and therefore before any `import { AppModule } ...`) so that
 * env-dependent module registration (AuthModule's JwtModule.register,
 * TypeOrmModule.forRoot's `url`) picks up test values instead of
 * whatever's in the developer's real .env.
 *
 * Requires a real Postgres reachable at TEST_DATABASE_URL (or the default
 * below, matching docker-compose.test.yml) and a real Redis reachable at
 * REDIS_HOST/REDIS_PORT (BullModule/NotificationsModule need one to boot,
 * even though these tests never rely on a job actually being processed).
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/tuitionschool_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-do-not-use-in-prod';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6380';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
