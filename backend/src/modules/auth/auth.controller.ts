import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Stricter than the app-wide default (20/min) — login is the highest-value
  // brute-force target, so it gets its own tighter limit.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Only an already-authenticated super_admin can create new users
  // (school_admin, accountant, staff, parent, or another super_admin).
  // Phase 5A: a parent login is created here like any other user, then a
  // school_admin links it to specific students via POST /parent/link.
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Any authenticated user can change their own password.
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser('id') userId: string) {
    return this.authService.changePassword(userId, dto);
  }
}
