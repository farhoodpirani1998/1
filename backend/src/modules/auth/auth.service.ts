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
// ADR-001 Task 3A: resolves a student-role login's Student record via the
// student_users link table -- see StudentUser entity for why this is a
// join table rather than fields on either User or Student.
import { StudentUser } from '../students/entities/student-user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { Role } from '../../common/authorization/roles.enum';
import { SmsProviderService } from '../notifications/sms/sms-provider.service';

const BCRYPT_ROUNDS = 12;
const RESET_CODE_TTL_MINUTES = 10;
// Generic response for every forgot-password request, regardless of
// whether the phone number is registered — same "don't confirm which
// phone numbers exist" rule login() follows for bad credentials.
const RESET_REQUESTED_MESSAGE =
  'در صورتی که این شماره در سامانه ثبت شده باشد، کد بازیابی رمز عبور برای آن پیامک می‌شود.';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(StudentUser)
    private readonly studentUserRepo: Repository<StudentUser>,
    private readonly jwtService: JwtService,
    private readonly smsProviderService: SmsProviderService,
  ) {}

  async register(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    // Belt-and-suspenders alongside RegisterDto's @ValidateIf: every role
    // except super_admin and founder must own a school (founder's schools
    // are attached afterwards via POST /founder/link, same shape as a
    // parent login getting linked to students via POST /parent/link).
    // Kept here too in case this method is ever called from somewhere
    // that bypasses the HTTP ValidationPipe (e.g. a future seed/import
    // script).
    if (dto.role !== Role.SUPER_ADMIN && dto.role !== Role.FOUNDER && !dto.schoolId) {
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

  async login(
    dto: LoginDto,
  ): Promise<{
    accessToken: string;
    user: Omit<User, 'passwordHash'>;
    // Present only for a student-role login, resolved via StudentUser —
    // see the block below. Every other role gets undefined, same as
    // today.
    studentId?: string;
  }> {
    // Belt-and-suspenders alongside LoginDto's ValidateIf pair, which
    // only catches "neither field" (both @IsString run against
    // undefined). A request sending both is otherwise ambiguous about
    // which identifier should win, so it's rejected here rather than
    // silently preferring one.
    if (dto.phone && dto.username) {
      throw new BadRequestException('فقط یکی از شماره تلفن یا نام کاربری را وارد کنید');
    }

    // Username is a student-only login path today (see AddUsernameToUsers
    // migration), but this lookup doesn't hardcode that — it just resolves
    // whichever identifier the request supplied, same as the phone path
    // always has. Phone lookup below is byte-for-byte what it was before
    // this task; nothing about it changed.
    const user = dto.username
      ? await this.userRepo.findOne({ where: { username: dto.username } })
      : await this.userRepo.findOne({ where: { phone: dto.phone } });

    // Same error for "not found" and "wrong password" — avoids leaking
    // which phone numbers/usernames are registered. One generic message
    // regardless of which field was used to look the user up, for the
    // same reason.
    const invalidCredentialsError = new UnauthorizedException(
      dto.username ? 'نام کاربری یا رمز عبور اشتباه است' : 'شماره تلفن یا رمز عبور اشتباه است',
    );

    if (!user || !user.isActive) {
      throw invalidCredentialsError;
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentialsError;
    }

    // super_admin and founder have no single school (founder's schools
    // are the founder_schools join table, checked per-request in
    // FounderService instead) — every other role must belong to a
    // currently-active school, otherwise they'd get a token here only to
    // have every subsequent request rejected by JwtStrategy anyway.
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.FOUNDER) {
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

    // ADR-001 Task 3A: a student-role login is resolved to the single
    // Student record it's allowed to see via student_users -- the same
    // "look the link up per request, don't bake it into the token" shape
    // ParentService/TeacherService already use for their own portals (see
    // ParentController.findMyStudents). JwtPayload and AuthenticatedUser
    // stay exactly as they were before this task; the resolved id is
    // returned alongside the token instead, for the caller to use however
    // /student/* routes end up needing it once they exist.
    //
    // A student user with no student_users row yet (e.g. provisioned but
    // not linked) still logs in successfully -- studentId is simply
    // omitted, the same "no linked record" shape ParentService returns an
    // empty list for rather than failing the login itself.
    let studentId: string | undefined;
    if (user.role === Role.STUDENT) {
      const studentUser = await this.studentUserRepo.findOne({ where: { userId: user.id } });
      studentId = studentUser?.studentId;
    }

    const { passwordHash: _drop, ...safeUser } = user;
    return { accessToken, user: safeUser, ...(studentId ? { studentId } : {}) };
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

  // Step 1 of the forgot-password flow — works the same for every
  // portal (admin/staff, teacher, parent), since they all share this one
  // `users` table and POST /auth/login. Always resolves with the same
  // message whether or not the phone is registered (see
  // RESET_REQUESTED_MESSAGE) so this endpoint can't be used to enumerate
  // accounts; the controller also throttles it like login.
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ success: true; message: string }> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });

    if (user && user.isActive) {
      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      user.resetCodeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
      user.resetCodeExpiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
      await this.userRepo.save(user);

      await this.smsProviderService.send({
        to: user.phone,
        text: `کد بازیابی رمز عبور شما: ${code}\nاین کد تا ${RESET_CODE_TTL_MINUTES} دقیقه معتبر است.`,
      });
    }

    return { success: true, message: RESET_REQUESTED_MESSAGE };
  }

  // Step 2 — confirms the code texted in step 1 and sets the new
  // password. One generic error for "no such phone", "no code
  // requested", "wrong code", and "expired code" alike — same
  // don't-leak-details rule as login().
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const invalidCodeError = new BadRequestException('کد نامعتبر یا منقضی شده است');

    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      throw invalidCodeError;
    }
    if (user.resetCodeExpiresAt.getTime() < Date.now()) {
      throw invalidCodeError;
    }

    const codeMatches = await bcrypt.compare(dto.code, user.resetCodeHash);
    if (!codeMatches) {
      throw invalidCodeError;
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    user.resetCodeHash = null;
    user.resetCodeExpiresAt = null;
    // Same as changePassword() — signs the user out of every other
    // session that was open with the old password.
    user.tokenVersion += 1;
    await this.userRepo.save(user);
    return { success: true };
  }
}
