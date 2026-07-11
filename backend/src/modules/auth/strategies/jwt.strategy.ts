 import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { Role } from '../../../common/authorization/roles.enum';

export interface JwtPayload {
  sub: string; // user id
  schoolId: string | null;
  role: string;
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Load from config service in real setup — inlined here for clarity.
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  // Whatever this returns becomes request.user, consumed by
  // @CurrentUser() and RolesGuard everywhere else in the app.
  //
  // Runs a DB round-trip on every authenticated request (not just at
  // login) so revocation is real: a token signed before a password
  // change, deactivation, or the user's school going inactive stops
  // working immediately, instead of staying valid until it expires.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    // Same generic message for every rejection reason below — a stale or
    // tampered token should never reveal *why* it was rejected (user
    // deleted vs deactivated vs password changed vs school inactive).
    if (!user || !user.isActive) {
      throw new UnauthorizedException('نشست شما معتبر نیست، لطفاً دوباره وارد شوید');
    }

    // tokenVersion mismatch = token was issued before a password change /
    // security reset that bumped it. Reject even though the signature and
    // expiry are otherwise valid.
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('نشست شما معتبر نیست، لطفاً دوباره وارد شوید');
    }

    // super_admin has no school, so there's nothing to check; every other
    // role must belong to a currently-active school.
    if (user.role !== Role.SUPER_ADMIN) {
      if (!user.schoolId) {
        throw new UnauthorizedException('نشست شما معتبر نیست، لطفاً دوباره وارد شوید');
      }
      const school = await this.schoolRepo.findOne({ where: { id: user.schoolId } });
      if (!school || !school.isActive) {
        throw new UnauthorizedException('مدرسه شما غیرفعال شده است');
      }
    }

    return {
      id: user.id,
      schoolId: user.schoolId as string,
      role: user.role,
    };
  }
}
