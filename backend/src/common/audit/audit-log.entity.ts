import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from '../../modules/schools/entities/school.entity';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Actions worth an audit row. Kept as a plain string enum (not DB-driven)
 * so adding a new action is a one-line change, same spirit as
 * common/authorization/permissions.ts.
 */
export enum AuditAction {
  CREATE_PAYMENT = 'CREATE_PAYMENT',
  VOID_PAYMENT = 'VOID_PAYMENT',
  CREATE_TUITION_PLAN = 'CREATE_TUITION_PLAN',
  UPDATE_TUITION_PLAN = 'UPDATE_TUITION_PLAN',
  CREATE_INSTALLMENT = 'CREATE_INSTALLMENT',
  UPDATE_INSTALLMENT = 'UPDATE_INSTALLMENT',
  DISCOUNT_APPLIED = 'DISCOUNT_APPLIED',
}

/**
 * Append-only — see the `trg_forbid_audit_log_update` trigger in the
 * migration. AuditService only ever INSERTs; there is no update()/
 * remove() method on it on purpose.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ name: 'school_id', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
