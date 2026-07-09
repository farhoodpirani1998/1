import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Installment } from './installment.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  CARD_TO_CARD = 'card_to_card',
  CHEQUE = 'cheque',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Installment, (installment) => installment.payments, {
    nullable: false,
  })
  @JoinColumn({ name: 'installment_id' })
  installment: Installment;

  @Column({ name: 'installment_id' })
  installmentId: string;

  @Column({ type: 'numeric', precision: 14, scale: 0 })
  amount: number;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'reference_number', length: 100, nullable: true })
  referenceNumber: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receivedBy: User | null;

  @Column({ name: 'received_by', nullable: true })
  receivedById: string | null;

  @Column({ name: 'paid_at', type: 'timestamp' })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
