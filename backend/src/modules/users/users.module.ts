import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { UsersController, UsersMeController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarStorageService } from '../../common/storage/avatar-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, School])],
  controllers: [UsersController, UsersMeController],
  providers: [UsersService, AvatarStorageService],
  exports: [UsersService],
})
export class UsersModule {}
