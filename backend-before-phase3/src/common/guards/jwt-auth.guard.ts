import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Delegates to the 'jwt' Passport strategy (see modules/auth/strategies/jwt.strategy.ts).
// A valid token attaches { id, schoolId, role } to request.user for
// CurrentUser / RolesGuard / tenant scoping to consume downstream.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
