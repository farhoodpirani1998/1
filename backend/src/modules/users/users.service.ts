import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return users.map(({ passwordHash: _drop, ...safe }) => safe);
  }

  // Generalized from the old setActive(id, isActive) to accept any
  // combination of isActive/fullName/phone (see UpdateUserDto). role and
  // schoolId are never accepted here — not because this method strips
  // them, but because UpdateUserDto never declares them, so
  // ValidationPipe's whitelist already rejects/strips them before this
  // method ever sees them.
  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      // Same conflict check as AuthService.register — phone is the
      // login identifier, so it must stay unique across all users.
      const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (existing) {
        throw new ConflictException('این شماره تلفن قبلاً ثبت شده است');
      }
      user.phone = dto.phone;
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      user.isActive = dto.isActive;
      // Any existing JWT for this user (issued while active, or before
      // this toggle) should stop working the moment status changes —
      // bumping tokenVersion forces JwtStrategy to reject it on the next
      // request, rather than waiting up to 7 days for natural expiry.
      // Only the isActive branch bumps this: editing just fullName/phone
      // doesn't need to force every other session to re-login.
      user.tokenVersion += 1;
    }

    const saved = await this.userRepo.save(user);
    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }

  async resetPassword(id: string, newPassword: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Same reasoning as AuthService.changePassword — invalidates every
    // JWT issued before this reset, forcing re-login with the new
    // password on every other session.
    user.tokenVersion += 1;
    const saved = await this.userRepo.save(user);
    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }
}
