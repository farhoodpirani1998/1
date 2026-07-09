import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

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

  async setActive(id: string, isActive: boolean): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    user.isActive = isActive;
    // Any existing JWT for this user (issued while active, or before this
    // toggle) should stop working the moment status changes — bumping
    // tokenVersion forces JwtStrategy to reject it on the next request,
    // rather than waiting up to 7 days for natural expiry.
    user.tokenVersion += 1;
    const saved = await this.userRepo.save(user);
    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }
}
