import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { roleHasPermission } from './permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No @RequirePermission() on the route → this guard doesn't apply;
    // RolesGuard already ran and is the authority for this route.
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !roleHasPermission(user.role, required as any)) {
      throw new ForbiddenException(
        'نقش شما مجوز انجام این عملیات حساس را ندارد',
      );
    }
    return true;
  }
}
