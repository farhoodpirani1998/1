import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { Announcement } from './announcement.entity';

// Sprint A.4 — Teacher Announcement Read Tracking.
//
// One row per (announcement, user) read, enforced by a unique index
// (uq_announcement_read_announcement_user, see the migration) -- same
// "one row per pairing, never duplicated" shape as
// uq_homework_submission_homework_student (HomeworkSubmission) and
// uq_attendance_student_date (Attendance). Unlike those two, there is no
// "correct in place" case here: a read either has or hasn't happened yet,
// so AnnouncementsService.markAsRead() only ever inserts once and returns
// the existing row on every later call -- readAt is fixed at first read,
// never overwritten by a repeat call (see that method's own comment).
//
// school_id is stored directly on the row (not derived only through the
// announcement or user join), same reasoning every other tenant-scoped
// table in this codebase (Announcement, Attendance, HomeworkSubmission,
// ...) already stores its own scoping column rather than requiring a join
// for every tenant-scoped read.
@Entity('announcement_reads')
export class AnnouncementRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Announcement, { nullable: false })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Announcement;

  @Column({ name: 'announcement_id' })
  announcementId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  // Set once, at insert time -- see the class header comment for why
  // this is never updated on a later call.
  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}
