import { LoggerService, LogLevel } from '@nestjs/common';
import pino from 'pino';
import { getRequestContext } from './request-context';

type PinoInstance = ReturnType<typeof pino>;

/**
 * Structured (JSON) logger implementing Nest's LoggerService interface.
 *
 * Passed to NestFactory.create(AppModule, { logger: new AppLogger() }) in
 * main.ts. Nest routes every `new Logger(context)` call used throughout the
 * codebase (ExceptionFilter, cron jobs, listeners, etc. — see grep for
 * `new Logger(` — none of that call-site code needs to change) through
 * whatever instance was registered via the `logger` bootstrap option /
 * `app.useLogger()`, so this is a drop-in replacement for the default
 * console logger, not a parallel logging path.
 *
 * Every line is enriched with requestId/userId/schoolId from the
 * AsyncLocalStorage-based request context when one is active (see
 * request-context.ts), satisfying "include userId and schoolId in logs
 * when available" without changing any existing service's code.
 */
export class AppLogger implements LoggerService {
  private readonly pino: PinoInstance;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    let transport: { target: string; options: Record<string, unknown> } | undefined;
    if (!isProduction) {
      // Pretty-printed, human-readable logs for local development only.
      // pino-pretty is a devDependency — never present (and never
      // reached, since NODE_ENV=production) in the production image.
      try {
        require.resolve('pino-pretty');
        transport = { target: 'pino-pretty', options: { colorize: true, singleLine: true } };
      } catch {
        transport = undefined;
      }
    }

    this.pino = pino({
      level,
      ...(transport ? { transport } : {}),
      // Never let secrets or credentials leak into log output.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.passwordHash',
          '*.token',
        ],
        remove: true,
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels?(levels: LogLevel[]): void {
    // Custom logger owns its own level (LOG_LEVEL env var); nothing to do
    // here, but the method must exist to satisfy LoggerService callers
    // that invoke it (e.g. NestFactory when `logger` option is an object).
    void levels;
  }

  private write(
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const params = [...optionalParams];
    // Nest's built-in Logger always appends its `context` (e.g. class
    // name) as the final argument. Everything else (typically a stack
    // trace string passed to `.error(message, trace)`) is kept as `trace`.
    const context =
      params.length > 0 && typeof params[params.length - 1] === 'string'
        ? (params.pop() as string)
        : undefined;
    const trace = params.length > 0 ? params.map(String).join(' ') : undefined;

    const store = getRequestContext();

    const payload: Record<string, unknown> = {
      ...(context ? { context } : {}),
      ...(trace ? { trace } : {}),
      ...(store?.requestId ? { requestId: store.requestId } : {}),
      ...(store?.userId ? { userId: store.userId } : {}),
      ...(store?.schoolId ? { schoolId: store.schoolId } : {}),
    };

    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.pino[level](payload, msg);
  }
}
