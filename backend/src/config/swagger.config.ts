import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

// Swagger UI (served by @nestjs/swagger's SwaggerModule.setup below) ships
// its own inline bootstrap <script> and inline <style> tags, which
// helmet()'s default global CSP (registered once in main.ts, applied to
// every route) deliberately does not allow -- that default stays locked
// down for the real API surface. Applying THIS relaxed policy only on the
// Swagger path (see main.ts, mounted before setupSwagger()) keeps every
// other route on the strict default and touches nothing else.
export function swaggerCspMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // swagger-ui-dist's bundle inlines its init script and CSS.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
}

// Mounted at this path, i.e. GET /api/v1/docs once the app's global prefix
// is applied. Also serves the raw OpenAPI JSON at /api/v1/docs-json
// (SwaggerModule's default), useful for generating a typed frontend client
// or importing into Postman/Insomnia.
export const SWAGGER_DOCS_PATH = 'docs';

/**
 * Enabled only when ENABLE_SWAGGER=true (exact string match) — regardless
 * of NODE_ENV. This means:
 *   - Local/dev: opt-in via ENABLE_SWAGGER=true in .env.
 *   - Production: disabled unless an operator deliberately sets the var,
 *     which is deliberately NOT the recommended production posture (see
 *     docs/deployment/DEPLOYMENT.md) — the doc UI has no auth of its own,
 *     so anyone who can reach it can read every route/DTO shape.
 * Unset, "false", or any other value all mean "disabled" — there is no
 * accidental-enable path.
 */
export function isSwaggerEnabled(): boolean {
  return process.env.ENABLE_SWAGGER === 'true';
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Tuition School API')
    .setDescription(
      'REST API for the multi-school tuition/attendance/homework management system. ' +
        'All endpoints are prefixed with /api/v1. Most endpoints require a Bearer JWT ' +
        "obtained from POST /api/v1/auth/login — use the 'Authorize' button below.",
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the access token returned by POST /auth/login (no "Bearer " prefix needed here).',
      },
      // Referenced by @ApiBearerAuth('access-token') on protected controllers.
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_DOCS_PATH, app, document, {
    // SwaggerModule.setup()'s mount path is NOT prefixed by
    // app.setGlobalPrefix() by default (SWAGGER_DOCS_PATH stays the bare
    // 'docs' segment above) -- without this flag the UI would actually be
    // served at /docs, not /api/v1/docs, leaving the CSP relaxation this
    // module mounts at /api/v1/docs (see main.ts) applied to a path Swagger
    // never uses, and the real /docs route stuck with helmet()'s strict
    // default CSP (blocking Swagger UI's inline bootstrap script/styles).
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
