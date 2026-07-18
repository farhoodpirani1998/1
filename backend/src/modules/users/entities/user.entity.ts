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
