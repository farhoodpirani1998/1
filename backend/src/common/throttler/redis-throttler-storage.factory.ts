import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

/**
 * Owns the Redis-backed ThrottlerStorage used by ThrottlerModule (see
 * app.module.ts's ThrottlerModule.forRootAsync). @nestjs/throttler's
 * default storage is in-memory, so behind a load balancer with multiple
 * app instances each instance would enforce its own independent counter
 * -- effectively multiplying the configured limit by the instance count.
 * Backing it with Redis gives all instances one shared counter, matching
 * the documented "global 20/min, auth 5/min" limits exactly rather than
 * per-instance. None of that throttling behavior changes here.
 *
 * Uses its own dedicated connection (not reused from BullMQ), same
 * reasoning as RedisHealthIndicator: throttling traffic on every request
 * shouldn't contend with, or be skewed by, actual job-processing load.
 * Same REDIS_HOST/REDIS_PORT/REDIS_PASSWORD env vars as every other Redis
 * consumer in this project (see app.module.ts's BullModule connection).
 *
 * Sprint 3 Phase 1 — reliability hardening: previously this was a plain
 * factory function called inline in ThrottlerModule.forRoot()'s options
 * object, so the ioredis client it created was never registered with
 * Nest's DI container and had no lifecycle hook -- it could be left open
 * on application shutdown. Wrapping it as an injectable singleton
 * (provided once via ThrottlerRedisStorageModule, see below) and
 * implementing OnModuleDestroy lets Nest close it the same way
 * RedisHealthIndicator closes its own connection.
 */
@Injectable()
export class ThrottlerRedisStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(ThrottlerRedisStorageService.name);
  private readonly client: Redis;
  readonly storage: ThrottlerStorageRedisService;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      // Undefined (not empty string) when unset, so ioredis skips AUTH in
      // dev -- env.validation.ts already refuses to boot in production
      // without REDIS_PASSWORD set.
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Without a listener, ioredis's 'error' event (e.g. a transient
    // connection drop) is an unhandled event and crashes the process --
    // same defensive pattern as redis-health.indicator.ts.
    this.client.on('error', () => undefined);

    this.storage = new ThrottlerStorageRedisService(this.client);
  }

  /**
   * Graceful shutdown: `quit()` waits for any in-flight command to
   * finish and sends QUIT before closing the socket, rather than
   * `disconnect()`'s immediate/hard close -- appropriate here since,
   * unlike the health check's short-lived ping, this connection may have
   * a throttling command in flight when shutdown begins. Swallowed
   * because a shutdown-time Redis error shouldn't block or fail the
   * rest of the app's teardown.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      this.logger.warn(
        `Error closing throttler Redis connection during shutdown: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
