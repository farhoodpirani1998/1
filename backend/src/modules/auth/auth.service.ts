import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { Role } from '../../common/authorization/roles.enum';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    // Belt-and-suspenders alongside RegisterDto's @ValidateIf: every role
    // except super_admin must own a school. Kept here too in case this
    // method is ever called from somewhere that bypasses the HTTP
    // ValidationPipe (e.g. a future seed/import script).
    if (dto.role !== Role.SUPER_ADMIN && !dto.schoolId) {
      throw new BadRequestException('برای این نقش، مدرسه الزامی است');
    }

    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException('این شماره تلفن قبلاً ثبت شده است');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      schoolId: dto.schoolId ?? null,
      fullName: dto.fullName,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
      isActive: true,
    });
    const saved = await this.userRepo.save(user);
    const { passwordHash: _drop, ...safeUser } = saved;
    return safeUser;
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Omit<User, 'passwordHash'> }> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });

    // Same error for "not found" and "wrong password" — avoids leaking
    // which phone numbers are registered.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('شماره تلفن یا رمز عبور اشتباه است');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('شماره تلفن یا رمز عبور اشتباه است');
    }

    // super_admin has no school; every other role must belong to a
    // currently-active school — otherwise they'd get a token here only
    // to have every subsequent request rejected by JwtStrategy anyway.
    if (user.role !== Role.SUPER_ADMIN) {
      const school = user.schoolId
        ? await this.schoolRepo.findOne({ where: { id: user.schoolId } })
        : null;
      if (!school || !school.isActive) {
        throw new UnauthorizedException('مدرسه شما غیرفعال شده است');
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      schoolId: user.schoolId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = this.jwtService.sign(payload);

    const { passwordHash: _drop, ...safeUser } = user;
    return { accessToken, user: safeUser };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new BadRequestException('رمز عبور فعلی اشتباه است');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    // Invalidates every JWT issued before this change — the next request
    // from any other still-logged-in session fails tokenVersion
    // verification in JwtStrategy and must log in again with the new
    // password.
    user.tokenVersion += 1;
    await this.userRepo.save(user);
    return { success: true };
  }
}
