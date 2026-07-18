import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TuitionPlan } from './tuition-plan.entity';
import { Payment } from './payment.entity';

export enum InstallmentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  DEFERRED = 'deferred',
  DISPUTED = 'disputed',
  // Debt forgiven by the school (not paid, not simply cancelled — the
  // distinction matters for financial reporting). Terminal, like
  // CANCELLED: see InstallmentStateMachine for why nothing transitions
  // out of it automatically.
  WRITTEN_OFF = 'written_off',
}

@Entity('installments')
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TuitionPlan, (plan) => plan.installments, {
    nullable: false,
  })
  @JoinColumn({ name: 'tuition_plan_id' })
  tuitionPlan: TuitionPlan;

  @Column({ name: 'tuition_plan_id' })
  tuitionPlanId: string;

  @Column({ name: 'installment_number', type: 'int' })
  installmentNumber: number;

  @Column({ type: 'numeric', precision: 14, scale: 0 })
  amount: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: InstallmentStatus.PENDING,
  })
  status: InstallmentStatus;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 14,
    scale: 0,
    default: 0,
  })
  paidAmount: number;

  @OneToMany(() => Payment, (payment) => payment.installment)
  payments: Payment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
