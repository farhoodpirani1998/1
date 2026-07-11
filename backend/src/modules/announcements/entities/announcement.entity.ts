import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

// Who an announcement is meant for. 'all' is a broadcast (every
// authenticated user in the school, across every reader role); the other
// three narrow it to one reader population. Kept as a small closed enum,
// same shape as AttendanceStatus / AssessmentTerm, rather than free text --
// AnnouncementsService.findForAudience() depends on there being a fixed,
// known set of values to filter ('all' OR the caller's own audience).
export enum AnnouncementTargetType {
  ALL = 'all',
  PARENTS = 'parents',
  TEACHERS = 'teachers',
  STAFF = 'staff',
}

// One row per posted announcement. Unlike Attendance/Assessment there is
// no upsert-on-resubmit key here -- an announcement is a one-shot post
// (create or delete, never "correct in place"), so no unique index is
// needed beyond the primary key.
//
// school_id is stored directly on the row (not derived only through a
// join), same reasoning attendance/student_assessments/notifications
// already store their own tenant-scoping column rather than requiring a
// join for every tenant-scoped read.
@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType: AnnouncementTargetType;

  // Nullable (not the FK itself being optional in practice -- every
  // create() call passes the caller's own id) for the same reason
  // Attendance.recordedById / Assessment.recordedById are nullable: so a
  // future admin-deletion of the creating user's account doesn't force a
  // cascade delete of every announcement they ever posted.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
