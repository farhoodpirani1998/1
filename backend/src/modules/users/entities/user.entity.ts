import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ name: 'school_id', nullable: true })
  schoolId: string | null; // null for super_admin and founder (founder's schools live in founder_schools instead)

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  // ADR-001 Task 3A: second login identifier, alongside (not instead of)
  // `phone` -- used by student-role logins today, but not restricted to
  // that role at the schema level, same way `phone` isn't restricted to
  // any particular role. NULL for every user who has no username set,
  // which Postgres allows any number of under the unique constraint (see
  // migration 1738400000000-AddUsernameToUsers). Lives here and not on
  // Student: per the architecture rule that User is the only identity
  // entity, Student stays academic-only, and a login reaches its Student
  // record through StudentUser, never through login fields on Student
  // itself.
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  username: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 30 })
  role: string; // super_admin, school_admin, accountant, staff

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Bumped whenever previously-issued JWTs for this user should stop
  // working (password change, security reset, deactivation) — JwtStrategy
  // rejects any token whose embedded tokenVersion doesn't match this
  // column's current value. See auth/strategies/jwt.strategy.ts.
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  // Forgot-password flow (see PasswordReset migration + AuthService).
  // Both null when no reset is in progress; set together on request,
  // cleared together on successful confirm.
  @Column({ name: 'reset_code_hash', type: 'varchar', length: 255, nullable: true })
  resetCodeHash: string | null;

  @Column({ name: 'reset_code_expires_at', type: 'timestamp', nullable: true })
  resetCodeExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
