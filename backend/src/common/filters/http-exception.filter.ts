import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { getRequestContext } from '../logging/request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message = isHttpException
      ? typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message ?? exception.message
      : 'خطای داخلی سرور رخ داده است';

    // Unexpected errors (DB down, bugs, etc.) are logged with full detail
    // server-side but never exposed to the client — only HttpExceptions
    // (which callers threw deliberately, e.g. NotFoundException) carry
    // their message back in the response.
    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Sentry: additional reporting destination alongside the logger
    // above, not a replacement. Reports genuinely unexpected errors only
    // — never an intentionally-thrown HttpException in the 4xx range
    // (BadRequestException, UnauthorizedException, NotFoundException,
    // validation errors, etc.), which are expected control flow, not
    // bugs. A deliberately-thrown 5xx HttpException (rare, but possible)
    // is still reported, same as any non-HttpException. A no-op when
    // SENTRY_DSN isn't configured — see config/sentry.config.ts.
    if (!isHttpException || status >= 500) {
      const rc = getRequestContext();
      Sentry.withScope((scope) => {
        if (rc?.requestId) scope.setTag('requestId', rc.requestId);
        if (rc?.userId) scope.setUser({ id: rc.userId });
        if (rc?.schoolId) scope.setTag('schoolId', rc.schoolId);
        if (rc?.role) scope.setTag('role', rc.role);
        Sentry.captureException(exception);
      });
    }

    // Set by RequestIdMiddleware on every request; falls back to the
    // AsyncLocalStorage context in case this filter ever runs outside the
    // normal Express request path.
    const requestId =
      (request as Request & { requestId?: string }).requestId ?? getRequestContext()?.requestId;

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}
