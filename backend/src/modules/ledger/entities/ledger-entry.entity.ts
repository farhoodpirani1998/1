import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { TuitionPlan } from '../../tuition/entities/tuition-plan.entity';
import { User } from '../../users/entities/user.entity';

export enum LedgerEntryType {
  CHARGE = 'CHARGE', // a tuition plan was created — student now owes this
  DISCOUNT = 'DISCOUNT', // a discount reduced what's owed (negative to CHARGE)
  PAYMENT = 'PAYMENT', // money came in — reduces the balance
  VOID = 'VOID', // reverses a prior PAYMENT (payment was voided/deleted)
}

export enum LedgerReferenceType {
  TUITION_PLAN = 'tuition_plan',
  PAYMENT = 'payment',
}

/**
 * Sign convention: positive amount = increases what the student owes,
 * negative amount = decreases it. So a CHARGE is positive, a PAYMENT is
 * negative, a DISCOUNT is negative (it reduces the charge), and a VOID
 * (reversing a payment) is positive (the payment's effect is undone).
 * Summing all rows for a student gives their current outstanding balance.
 *
 * This table is append-only — see the `trg_forbid_ledger_update` trigger
 * in the migration. LedgerService only ever INSERTs.
 */
@Entity('financial_ledger')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => TuitionPlan, { nullable: true })
  @JoinColumn({ name: 'tuition_plan_id' })
  tuitionPlan: TuitionPlan | null;

  @Column({ name: 'tuition_plan_id', nullable: true })
  tuitionPlanId: string | null;

  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType: LedgerEntryType;

  @Column({ type: 'numeric', precision: 14, scale: 0 })
  amount: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 30 })
  referenceType: LedgerReferenceType;

  @Column({ name: 'reference_id' })
  referenceId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy: User | null;

  @Column({ name: 'performed_by', nullable: true })
  performedById: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
