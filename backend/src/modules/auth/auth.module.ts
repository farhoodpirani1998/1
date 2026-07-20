import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
// ADR-001 Task 3A: AuthService resolves a student login's Student record
// via student_users -- see AuthService.login.
import { StudentUser } from '../students/entities/student-user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, School, StudentUser]),
    NotificationsModule,
    PassportModule,
    JwtModule.registerAsync({
      // Loaded from ConfigService rather than process.env directly, so the
      // secret is only read once Nest's DI has resolved config — not at
      // module-import time.
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
