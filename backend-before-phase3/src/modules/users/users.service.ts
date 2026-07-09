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
    const saved = await this.userRepo.save(user);
    const { passwordHash: _drop, ...safe } = saved;
    return safe;
  }
}
