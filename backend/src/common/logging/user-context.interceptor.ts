import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { requestContextStorage } from './request-context';

/**
 * Global interceptor (registered via APP_INTERCEPTOR in
 * ObservabilityModule). Interceptors run after guards, so by the time this
 * executes, JwtAuthGuard/JwtStrategy has already populated `request.user`
 * for authenticated routes. Copies id/schoolId into the same
 * AsyncLocalStorage store RequestIdMiddleware started, so every log line
 * for the rest of this request (and the error filter, if it fails) can
 * include them — without any controller/service being touched.
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
      const store = requestContextStorage.getStore();
      const user = request.user;

      if (store && user) {
        store.userId = user.id;
        store.schoolId = user.schoolId ?? undefined;
      }
    }

    return next.handle();
  }
}
