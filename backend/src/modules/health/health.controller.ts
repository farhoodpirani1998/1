import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisHealthIndicator } from './redis-health.indicator';

// Deliberately no @UseGuards(...) — load balancers, container
// orchestrators (Kubernetes probes), and uptime monitors hit these
// unauthenticated, the same way every other public infra health endpoint
// works. @SkipThrottle so frequent probing never trips the global
// ThrottlerGuard registered as APP_GUARD in app.module.ts.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // Liveness: "is this process still responsive?" Deliberately checks
  // nothing external. A transient Postgres/Redis blip shouldn't make an
  // orchestrator kill and restart an otherwise-healthy pod — that's what
  // /ready is for.
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  // Readiness: "can this instance actually serve traffic right now?"
  // Wire this into your load balancer / Kubernetes readiness probe.
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 2000 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  // Combined view — convenient for humans and simple uptime monitors that
  // only want to hit one URL.
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 2000 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
