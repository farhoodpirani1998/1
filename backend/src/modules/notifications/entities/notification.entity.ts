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

// Phase 5C: distinguishes *why* a notification exists, independent of
// NotificationStatus (which only tracks SMS delivery). Parents need this
// to render/label their in-app notification list; the SMS processor also
// uses it to pick the right message body.
export enum NotificationType {
  PAYMENT_RECEIVED = 'payment_received',
  OVERDUE_INSTALLMENT = 'overdue_installment',
  UPCOMING_DUE = 'upcoming_due',
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

  @ManyToOne(() => Installment, { nullable: false })
  @JoinColumn({ name: 'installment_id' })
  installment: Installment;

  @Column({ name: 'installment_id' })
  installmentId: string;

  @Column({ type: 'varchar', length: 20, default: 'sms' })
  channel: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  // Phase 5C: what this notification is about — see NotificationType.
  // Defaulted at the DB level to OVERDUE_INSTALLMENT (the only kind that
  // existed before this phase) so the migration doesn't need to backfill
  // existing rows individually.
  @Column({
    type: 'varchar',
    length: 30,
    default: NotificationType.OVERDUE_INSTALLMENT,
  })
  type: NotificationType;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  // Phase 5C: parent-portal "read" state, separate from `status` (SMS
  // delivery) — a notification can be SENT via SMS and still unread in
  // the parent's in-app list, or never sent by SMS (e.g. no phone on
  // file) yet still readable/markable in the portal.
  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

