import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { Subject } from '../../student-assessments/entities/subject.entity';
import { User } from '../../users/entities/user.entity';

// Iranian school week, Saturday first -- same "closed enum, not free
// text" reasoning as AttendanceStatus / AssessmentTerm /
// AnnouncementTargetType: TimetableService's overlap check depends on
// there being a small, known set of values to group rows by.
export enum Weekday {
  SATURDAY = 0,
  SUNDAY = 1,
  MONDAY = 2,
  TUESDAY = 3,
  WEDNESDAY = 4,
  THURSDAY = 5,
  FRIDAY = 6,
}

// One row per scheduled class period: (grade, subject, teacher) meeting
// on one weekday for one time range, within one academic year. Unlike
// Announcement this *does* get corrected in place (PUT /timetable/:id),
// so it carries both createdAt and updatedAt, same shape as
// TuitionPlan/Installment.
//
// No DB-level overlap constraint (e.g. an exclusion constraint on
// (teacher_id, weekday, time range)) is used here -- Postgres exclusion
// constraints need the `btree_gist` extension enabled, which is a step
// beyond what this phase's migration should take on. Overlap is instead
// enforced in TimetableService before every insert/update, the same
// "application-layer invariant checked in the service, not pushed down
// to a DB constraint" shape TeacherAssignment's idempotent-upsert and
// Installment's status transitions already use.
//
// school_id is stored directly on the row (not derived only through a
// join), same reasoning attendance/student_assessments/announcements
// already store their own tenant-scoping column rather than requiring a
// join for every tenant-scoped read.
@Entity('timetable_entries')
export class TimetableEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @ManyToOne(() => Grade, { nullable: false })
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;

  @Column({ name: 'grade_id' })
  gradeId: string;

  @ManyToOne(() => Subject, { nullable: false })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ type: 'smallint' })
  weekday: Weekday;

  // Stored as Postgres TIME, read back as 'HH:MM:SS' by node-postgres --
  // CreateTimetableEntryDto accepts/normalizes 'HH:MM', same "date/time
  // as a plain string, not a Date object" convention AcademicYear.startDate
  // / Installment.dueDate already use.
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  room: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
