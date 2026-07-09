import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Pings the same Redis instance BullModule connects to (see
 * app.module.ts's BullModule.forRoot host/port). Uses its own dedicated
 * connection (not reused from BullMQ) so a health check never contends
 * with, or is skewed by, actual job-processing traffic.
 */
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      // Must match app.module.ts's BullModule connection -- an
      // unauthenticated ping against a password-protected Redis would
      // report the instance as "down" even though it's actually healthy.
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // A health check should fail fast and report "down", not sit in
      // ioredis's default reconnect/backoff loop.
      retryStrategy: () => null,
    });

    // Without a listener, ioredis's 'error' event (e.g. connection
    // refused) would be an unhandled event and crash the process; the
    // failure is surfaced instead via the rejected promise in pingCheck().
    this.client.on('error', () => undefined);
  }

  async pingCheck(key: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<HealthIndicatorResult> {
    try {
      if (this.client.status === 'end' || this.client.status === 'wait') {
        await this.client.connect();
      }

      const pong = await Promise.race([
        this.client.ping(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs);
        }),
      ]);

      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${String(pong)}`);
      }

      return { [key]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError('Redis check failed', {
        [key]: {
          status: 'down',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
