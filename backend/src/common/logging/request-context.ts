import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request context propagated via Node's AsyncLocalStorage so that any
 * log line emitted anywhere during a request's lifecycle (middleware,
 * guards, services, the exception filter) can be tagged with the same
 * requestId — and, once the JWT strategy has run, the same userId/schoolId
 * — without threading those values through every function signature.
 *
 * Established once per request by RequestIdMiddleware (see
 * request-id.middleware.ts) and enriched with userId/schoolId by
 * UserContextInterceptor (see user-context.interceptor.ts) once
 * request.user is available.
 */
export interface RequestContextStore {
  requestId: string;
  userId?: string;
  schoolId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}
