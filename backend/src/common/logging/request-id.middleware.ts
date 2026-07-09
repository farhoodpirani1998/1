import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from './request-context';

// Accepts a caller-supplied X-Request-Id only if it looks like a sane
// identifier (bounded length, safe charset) — otherwise a spoofed/garbage
// header would end up embedded verbatim in structured logs and error
// responses. Anything else gets a fresh server-generated id.
const SAFE_REQUEST_ID = /^[a-zA-Z0-9-_]{1,100}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Establishes the AsyncLocalStorage context for the rest of this
    // request's lifecycle (guards, interceptors, handlers, the exception
    // filter, and the 'finish' listener registered by HttpLoggerMiddleware
    // all run within this callback's async scope).
    requestContextStorage.run({ requestId }, () => next());
  }
}
