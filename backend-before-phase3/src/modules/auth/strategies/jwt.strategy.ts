import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string; // user id
  schoolId: string | null;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Load from config service in real setup — inlined here for clarity.
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  // Whatever this returns becomes request.user, consumed by
  // @CurrentUser() and RolesGuard everywhere else in the app.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      id: payload.sub,
      schoolId: payload.schoolId as string,
      role: payload.role,
    };
  }
}
