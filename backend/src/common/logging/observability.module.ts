import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpLoggerMiddleware } from './http-logger.middleware';
import { RequestIdMiddleware } from './request-id.middleware';
import { UserContextInterceptor } from './user-context.interceptor';

/**
 * Phase 4B observability wiring: request-id tracking + structured HTTP
 * access logging + request-scoped userId/schoolId enrichment. Self
 * contained so app.module.ts only needs a single new import — no changes
 * to existing providers/controllers/modules.
 */
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, HttpLoggerMiddleware).forRoutes('*');
  }
}
