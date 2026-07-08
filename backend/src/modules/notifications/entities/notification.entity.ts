import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Installment } from '../../tuition/entities/installment.entity';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum NotificationTemplate {
  OVERDUE_REMINDER = 'overdue_reminder',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  WELCOME = 'welcome',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  // Null for templates that aren't about a specific installment (e.g. welcome).
  @ManyToOne(() => Installment, { nullable: true })
  @JoinColumn({ name: 'installment_id' })
  installment: Installment | null;

  @Column({ name: 'installment_id', nullable: true })
  installmentId: string | null;

  @Column({
    name: 'template',
    type: 'varchar',
    length: 30,
    default: NotificationTemplate.OVERDUE_REMINDER,
  })
  template: NotificationTemplate;

  @Column({ length: 20, default: 'sms' })
  channel: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
