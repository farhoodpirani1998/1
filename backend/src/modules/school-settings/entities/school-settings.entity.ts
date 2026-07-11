import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Weekday } from '../../timetable/entities/timetable-entry.entity';

// Exactly one row per school -- school_id is the primary key itself (not
// a separate `id` with a unique index on school_id), so the 1:1 is a DB
// guarantee rather than an application convention. Same reasoning as
// every other tenant-scoped table storing its tenant column directly on
// the row, except here that column *is* the primary key.
//
// Reuses the Weekday enum from modules/timetable (Saturday-first Iranian
// school week) for weekStartsOn/workingDays rather than inventing a
// second weekday representation.
@Entity('school_settings')
export class SchoolSettings {
  @PrimaryColumn({ name: 'school_id' })
  schoolId: string;

  @OneToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_name', type: 'varchar', length: 200 })
  schoolName: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 50, default: 'Asia/Tehran' })
  timezone: string;

  @Column({ type: 'varchar', length: 10, default: 'fa' })
  language: string;

  @Column({ type: 'varchar', length: 10, default: 'IRR' })
  currency: string;

  @Column({ name: 'week_starts_on', type: 'smallint', default: Weekday.SATURDAY })
  weekStartsOn: Weekday;

  // Postgres smallint[] -- TypeORM's `array: true` maps this cleanly to a
  // native JS number[] on read/write, same as any other array column in
  // this schema would.
  @Column({ name: 'working_days', type: 'smallint', array: true, default: '{0,1,2,3,4}' })
  workingDays: Weekday[];

  @Column({ name: 'passing_score', type: 'numeric', precision: 5, scale: 2, default: 10 })
  passingScore: number;

  @Column({ name: 'attendance_late_minutes', type: 'smallint', default: 15 })
  attendanceLateMinutes: number;

  @Column({ name: 'tuition_reminder_days', type: 'smallint', default: 7 })
  tuitionReminderDays: number;

  @Column({ name: 'sms_enabled', default: true })
  smsEnabled: boolean;

  @Column({ name: 'email_enabled', default: false })
  emailEnabled: boolean;

  @Column({ name: 'primary_color', type: 'varchar', length: 7, nullable: true })
  primaryColor: string | null;

  @Column({ name: 'secondary_color', type: 'varchar', length: 7, nullable: true })
  secondaryColor: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
