import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AvatarStorageService } from '../../common/storage/avatar-storage.service';

const BCRYPT_ROUNDS = 12;

// Shape returned by GET/PATCH /users/me — the caller's own safe user
// fields plus the one piece of data that isn't on the User row itself
// (the school's name; only schoolId is). super_admin/founder always get
// schoolName: null, same "no single school" shape AuthUser already has
// for those two roles.
export type MyProfile = Omit<User, 'passwordHash' | 'school'> & { schoolName: string | null };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly avatarStorage: AvatarStorageService,
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

  // Sprint A3 — My Profile. Self-service only: `id` always comes from
  // the caller's own token (see UsersMeController), same "no
  // client-supplied target" shape as updateAvatar/removeAvatar below.
  // Resolves schoolName via a second lookup rather than
  // `relations: ['school']` on the User query, so this stays a plain
  // additive read next to the existing findAll()/update() queries
  // above, with no join added to the User repository's default query
  // shape.
  async findMyProfile(id: string): Promise<MyProfile> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return this.toMyProfile(user);
  }

  // PATCH /users/me — fullName/phone only (see UpdateProfileDto).
  // Deliberately its own method rather than reusing update() above:
  // that one also accepts isActive and is only ever called by a
  // super_admin editing *another* user; this one is called by anyone
  // editing themselves, so isActive must never be in reach here even by
  // accident.
  async updateProfile(id: string, dto: UpdateProfileDto): Promise<MyProfile> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      // Same uniqueness check as update() above — phone is still the
      // login identifier even when the caller is editing their own row.
      const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (existing) {
        throw new ConflictException('این شماره تلفن قبلاً ثبت شده است');
      }
      user.phone = dto.phone;
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    const saved = await this.userRepo.save(user);
    return this.toMyProfile(saved);
  }

  private async toMyProfile(user: User): Promise<MyProfile> {
    const { passwordHash: _drop, school: _school, ...safe } = user;
    const schoolName = user.schoolId ? (await this.schoolRepo.findOne({ where: { id: user.schoolId } }))?.name ?? null : null;
    return { ...safe, schoolName };
  }

  // Sprint P1 — Universal Avatar System. Self-service only: `id` always
  // comes from the caller's own token (see UsersMeController), never a
  // client-supplied target, so there's no cross-user write path here.
  //
  // Saves the new file to disk before touching the DB row, then removes
  // whatever the *old* avatarUrl pointed at (if any) only after the new
  // one is safely persisted — so a mid-request failure never leaves the
  // user with neither an old nor a new file on disk.
  async updateAvatar(id: string, file: Express.Multer.File): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const previousAvatarUrl = user.avatarUrl;
    const newAvatarUrl = await this.avatarStorage.save(user.id, file);

    user.avatarUrl = newAvatarUrl;
    const saved = await this.userRepo.save(user);

    if (previousAvatarUrl) {
      await this.avatarStorage.remove(previousAvatarUrl);
    }

    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }

  // Reverts a user to the initial-letter placeholder every frontend
  // avatar component already falls back to when avatarUrl is null — same
  // "clear the reference, then clean up the file" ordering as
  // updateAvatar above.
  async removeAvatar(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const previousAvatarUrl = user.avatarUrl;
    user.avatarUrl = null;
    const saved = await this.userRepo.save(user);

    if (previousAvatarUrl) {
      await this.avatarStorage.remove(previousAvatarUrl);
    }

    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }
}
