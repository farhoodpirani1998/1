import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Stricter than the app-wide default (20/min) — login is the highest-value
  // brute-force target, so it gets its own tighter limit.
  @ApiOperation({ summary: 'Log in with phone (or student username) + password, returns a JWT' })
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
  @ApiOperation({ summary: 'Create a new user account (super_admin only)' })
  @ApiBearerAuth('access-token')
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Any authenticated user can change their own password.
  @ApiOperation({ summary: "Change the current user's own password" })
  @ApiBearerAuth('access-token')
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser('id') userId: string) {
    return this.authService.changePassword(userId, dto);
  }

  // Forgot-password step 1 — same tight rate limit as login, since this
  // is the other endpoint an attacker could hammer (to spam a phone with
  // SMS, or to try to enumerate registered numbers).
  @ApiOperation({ summary: 'Request a password-reset SMS code (step 1 of 2)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  // Forgot-password step 2 — confirms the SMS code and sets the new
  // password. Same rate limit as login, since this is a second
  // credential-guessing surface (the 6-digit code).
  @ApiOperation({ summary: 'Confirm the SMS code and set a new password (step 2 of 2)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
