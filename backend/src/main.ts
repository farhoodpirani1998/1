import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logging/app-logger.service';
import { AVATAR_URL_PREFIX, resolveAvatarUploadDir } from './common/storage/avatar-storage.service';
import { isSwaggerEnabled, setupSwagger, SWAGGER_DOCS_PATH } from './config/swagger.config';
import { initSentry } from './config/sentry.config';

async function bootstrap() {
  // Must run before NestFactory.create() so a failure during Nest's own
  // bootstrap (module wiring, DB connection, etc.) is still captured.
  // No-op when SENTRY_DSN is unset — see sentry.config.ts.
  initSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Structured (JSON in production, pretty in dev) logger — see
    // app-logger.service.ts. bufferLogs holds Nest's own bootstrap log
    // lines until this logger is ready, so nothing gets lost/printed via
    // the old console format before the switch takes effect.
    logger: new AppLogger(),
    bufferLogs: true,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // The app sits behind a reverse proxy / load balancer in production
  // (see docker-compose.yml, docs/DEPLOYMENT.md). Without this, Express
  // (and therefore ThrottlerGuard's per-IP limiting, and req.ip in logs)
  // sees the proxy's IP for every request instead of the real client's.
  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Let Nest catch SIGTERM/SIGINT (sent by Docker/Kubernetes on
  // stop/rolling-deploy) and run each module's OnModuleDestroy hook —
  // closes the Postgres pool, Redis connections, and in-flight BullMQ
  // jobs cleanly instead of the process being killed mid-request.
  app.enableShutdownHooks();

  app.use(helmet());

  // Sprint P1 — Universal Avatar System. Serves whatever
  // AvatarStorageService writes to disk (see common/storage/avatar-storage.service.ts)
  // back out at the same AVATAR_URL_PREFIX stored on User.avatarUrl.
  //
  // helmet()'s default Cross-Origin-Resource-Policy ('same-origin') would
  // otherwise block the frontend — a different origin per CORS_ORIGINS —
  // from actually rendering these images in an <img> tag, even though
  // enableCors() above already allows the request itself. Only this one
  // static route relaxes it; every other response keeps helmet's default.
  app.useStaticAssets(resolveAvatarUploadDir(), {
    prefix: AVATAR_URL_PREFIX,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);

  if (isProduction && (!configuredOrigins || configuredOrigins.length === 0)) {
    // Previously this fell through to `origin: true` (reflects every
    // request's Origin header, i.e. allow-all) whenever CORS_ORIGINS
    // wasn't set — safe for local dev, unacceptable in production where
    // it's usually a missing/forgotten env var, not an intentional
    // choice. Fail loudly at boot instead of silently running wide open.
    throw new Error(
      'CORS_ORIGINS must be set to a comma-separated list of allowed origins when NODE_ENV=production',
    );
  }

  app.enableCors({
    // Comma-separated list of allowed origins, e.g. "https://app.example.com,https://admin.example.com"
    // Development only: falls back to reflecting any origin (`true`) so
    // local frontends on arbitrary ports keep working without extra setup.
    origin: configuredOrigins ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not declared in the DTO
      forbidNonWhitelisted: true,
      transform: true, // enables the @Type() coercion used in DTOs
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api/v1');

  // Opt-in only (ENABLE_SWAGGER=true) regardless of environment — see
  // swagger.config.ts for the enable/disable rules. Deliberately after
  // setGlobalPrefix() so the generated doc's paths (and the UI's own URL,
  // under /api/v1/docs) match what clients actually call.
  if (isSwaggerEnabled()) {
    setupSwagger(app);
    new Logger('Bootstrap').warn(
      `Swagger UI enabled at /api/v1/${SWAGGER_DOCS_PATH} (ENABLE_SWAGGER=true, NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}). ` +
        'This endpoint is unauthenticated — do not enable in production unless deliberately intended.',
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
