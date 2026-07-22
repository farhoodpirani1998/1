import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Shape of the environment variables the app actually depends on.
 * Validated once at startup (wired via ConfigModule.forRoot({ validate })
 * in app.module.ts) so a missing/malformed value fails loudly at boot —
 * before Postgres/Redis connections are even attempted — instead of
 * surfacing later as a confusing runtime error (or, worse, a silent
 * insecure default like an open CORS policy).
 *
 * Fields required in every environment (DATABASE_URL, JWT_SECRET) use
 * plain decorators. Fields only required in production (CORS_ORIGINS,
 * REDIS_HOST, a minimum JWT_SECRET length) are checked separately in
 * validateEnv() below, since they must NOT block `npm run start:dev`.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsString()
  @MinLength(1, { message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1, { message: 'JWT_SECRET is required' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  // Controls whether the Swagger/OpenAPI UI + JSON document are mounted
  // (see main.ts). Only the literal string "true" enables it; anything
  // else (unset, "false", typos) is treated as disabled. Kept as a plain
  // string here rather than @IsBoolean() since env vars are always
  // strings on process.env — the true/false parsing happens in main.ts.
  @IsOptional()
  @IsIn(['true', 'false'])
  ENABLE_SWAGGER?: string;

  // Sentry error reporting (see config/sentry.config.ts). Both optional
  // in every environment, including production — an unconfigured DSN
  // simply means Sentry.init() is skipped and error reporting stays
  // off; it must never block boot.
  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsOptional()
  @IsString()
  SENTRY_ENVIRONMENT?: string;

  // Sprint 2 — Feature 2B: account-level brute-force lockout (see
  // AuthService.login). Both optional with defaults in auth.service.ts
  // (5 attempts / 15 minutes) so this never blocks boot when unset --
  // same "safe default, override only if you need to" treatment as
  // every other tunable in this section.
  @IsOptional()
  @IsInt()
  @Min(1)
  LOGIN_LOCKOUT_THRESHOLD?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  LOGIN_LOCKOUT_DURATION_MINUTES?: number;

  // Sprint 2 — Feature 1: selects the StorageProvider implementation
  // (see common/storage/storage.module.ts). Only 'local' exists today —
  // an S3 driver is a future addition, not implemented yet. Defaults to
  // 'local' when unset (see the useFactory default in StorageModule),
  // so this is optional here rather than required.
  @IsOptional()
  @IsIn(['local'])
  STORAGE_DRIVER?: string;

  // Sprint 3 Phase 1 — reliability hardening: threshold (ms) above which
  // TypeORM logs a query as slow (see maxQueryExecutionTime in
  // app.module.ts's TypeOrmModule.forRoot). Optional with a safe default
  // there (1000ms) so this never blocks boot when unset.
  @IsOptional()
  @IsInt()
  @Min(1)
  DB_SLOW_QUERY_THRESHOLD_MS?: number;

  // Sprint 3 Phase 2 — reliability hardening: how long SmsProviderService
  // waits for the SMS gateway before aborting the request (see
  // sms-provider.service.ts). Optional with a safe default there
  // (10000ms) so this never blocks boot when unset, and has no bearing
  // on whether SMS itself is configured (SMS_API_URL/SMS_API_KEY remain
  // the only gate for that, unchanged).
  @IsOptional()
  @IsInt()
  @Min(1)
  SMS_REQUEST_TIMEOUT_MS?: number;

  // Sprint 3 Phase 2 — reliability hardening: max Postgres connections
  // this app instance's pool may open (see `extra.max` in app.module.ts's
  // TypeOrmModule.forRoot). Optional with a safe default there (10,
  // matching pg's own default) so this never blocks boot when unset.
  @IsOptional()
  @IsInt()
  @Min(1)
  DB_POOL_MAX?: number;
}

// Minimum JWT_SECRET length enforced only in production — long enough to
// resist brute-force guessing of the HMAC key, without forcing a specific
// value on developers running locally with the .env.example placeholder.
const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (validated.NODE_ENV === Environment.Production) {
    const missing: string[] = [];
    if (!validated.CORS_ORIGINS) missing.push('CORS_ORIGINS');
    if (!validated.REDIS_HOST) missing.push('REDIS_HOST');
    // Redis has no auth by default. Requiring a password in production
    // means BullModule.forRoot / RedisHealthIndicator (app.module.ts,
    // health/redis-health.indicator.ts) always connect authenticated, and
    // docker-compose.yml's redis service always boots with --requirepass.
    if (!validated.REDIS_PASSWORD) missing.push('REDIS_PASSWORD');

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variable(s): ${missing.join(', ')}`,
      );
    }

    if (validated.JWT_SECRET.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters long in production`,
      );
    }
  }

  return validated;
}
