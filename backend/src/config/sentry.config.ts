import * as Sentry from '@sentry/node';

/**
 * Initializes the Sentry Node SDK for error reporting, if configured.
 * Called as the very first statement in main.ts's bootstrap(), before
 * NestFactory.create(), so an error thrown during Nest's own bootstrap
 * (module wiring, DB connection, etc.) is still captured.
 *
 * A no-op when SENTRY_DSN is unset: Sentry.init() is simply never
 * called, and every Sentry.captureException() call elsewhere (see
 * AllExceptionsFilter) silently does nothing in that case — the SDK's
 * documented behavior with no client installed. Local dev and any
 * environment that hasn't opted in behave exactly as before this
 * change.
 *
 * Sprint 1 scope is error reporting only. Tracing, profiling, session
 * replay, and release tracking are explicitly out of scope — see
 * docs/deployment/DEPLOYMENT.md.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
}
