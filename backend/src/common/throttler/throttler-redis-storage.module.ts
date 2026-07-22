import { Module } from '@nestjs/common';
import { ThrottlerRedisStorageService } from './redis-throttler-storage.factory';

/**
 * Thin wrapper module so ThrottlerRedisStorageService participates in
 * Nest's DI container (and therefore its shutdown lifecycle) and can be
 * injected into ThrottlerModule.forRootAsync's useFactory in app.module.ts.
 * DEFAULT provider scope (Nest's default) means this is a singleton, so
 * only one Redis connection is ever created regardless of how many places
 * import this module.
 */
@Module({
  providers: [ThrottlerRedisStorageService],
  exports: [ThrottlerRedisStorageService],
})
export class ThrottlerRedisStorageModule {}
