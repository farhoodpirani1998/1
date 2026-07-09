import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const isProduction = process.env.NODE_ENV === 'production';
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
