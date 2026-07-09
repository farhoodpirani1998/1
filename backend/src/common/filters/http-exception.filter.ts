import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
