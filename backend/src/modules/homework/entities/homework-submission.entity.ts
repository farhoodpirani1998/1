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
import { Student } from '../../students/entities/student.entity';
import { Homework } from './homework.entity';

// Sprint A.3.1 — Homework Submission Foundation.
//
// Kept as a small closed enum, same shape as AttendanceStatus /
// AssessmentTerm, rather than a free-text status -- future
// grading/reporting logic depends on there being a fixed, known set of
// states to branch on. `pending` is the row's default state before a
// student has submitted anything (or before the due date has passed);
// `missing` is a state something else (a scheduled job, or a read-time
// computation -- not decided by this schema) will need to derive once
// a due date passes with no submission, not a state a student ever sets
// directly.
export enum HomeworkSubmissionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  LATE = 'late',
  MISSING = 'missing',
}

// One row per (homework, student) -- see the unique index in the
// HomeworkSubmissions migration, uq_homework_submission_homework_student.
// Same "one row per pairing, corrected in place rather than duplicated on
// resubmission" shape as Attendance (uq_attendance_student_date) and
// Assessment (uq_assessment_student_subject_year_term); a future
// HomeworkSubmissionsService would upsert on that pair the same way
// AttendanceService.record() / AssessmentsService.record() already do,
// not implemented here (Sprint A.3.1 is schema/wiring only -- see
// HomeworkModule).
//
// Deliberately foundation-only: `submittedAt` is nullable (unset for a
// `pending` row), and there is no score/grade column and no attachment
// column yet -- those are exactly the "future grading and file
// attachments" this sprint prepares the shape for without implementing.
// When they land, they're additive columns on this same table (a score,
// a maxScore, a fileUrl reference -- same "store the reference, not the
// bytes" shape Homework.attachmentUrl already uses), not a new entity.
//
// school_id is stored directly on the row (not derived only through the
// homework or student join), same reasoning every other tenant-scoped
// table in this codebase (Attendance, Assessment, Homework itself, ...)
// already stores its own scoping column rather than requiring a join for
// every tenant-scoped read.
@Entity('homework_submissions')
export class HomeworkSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Homework, { nullable: false })
  @JoinColumn({ name: 'homework_id' })
  homework: Homework;

  @Column({ name: 'homework_id' })
  homeworkId: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  // Same "small closed enum stored as varchar" convention
  // AttendanceStatus / AssessmentTerm already use, rather than a
  // Postgres native enum type -- see those entities for the same
  // reasoning (adding a new status later is an application-level change,
  // not a migration that alters a database enum type).
  @Column({ type: 'varchar', length: 20, default: HomeworkSubmissionStatus.PENDING })
  status: HomeworkSubmissionStatus;

  // When the student actually submitted -- null until they do (a
  // `pending` row has no submittedAt yet), same "nullable timestamp, set
  // only once the thing it names has actually happened" shape as
  // Homework.attachmentUrl being nullable until an attachment actually
  // exists.
  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  // Sprint H3.0 — Homework Grading Foundation.
  //
  // Additive-only, same "future grading ... additive columns on this
  // same table" shape this entity's own header comment already
  // anticipated. All four columns are nullable: a submission is
  // gradeable regardless of status (this sprint does not restrict
  // grading to `submitted`/`late` rows -- see
  // HomeworkSubmissionService.gradeSubmission()), and an ungraded row
  // simply has all four columns unset, same "nullable until the thing
  // it names has actually happened" shape as `submittedAt` above.
  //
  // `score` is a plain integer (see GradeHomeworkSubmissionDto), not
  // numeric/decimal -- unlike Assessment.score (which normalizes
  // against a configurable maxScore for report-card averaging),
  // homework grading has no such normalization requirement yet, so
  // integer is the simplest column that satisfies today's validation
  // (min 0, optionally bounded by homework.maxScore once that field
  // exists -- see the DTO's own comment).
  @Column({ type: 'int', nullable: true })
  score: number | null;

  // Free-text teacher comment on the grade. Same "text column, no
  // length cap enforced at the schema level" shape as
  // Homework.description; length is bounded at the DTO layer instead
  // (see GradeHomeworkSubmissionDto).
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  // When the submission was last graded -- null until gradeSubmission()
  // sets it, same "nullable timestamp, set only once the thing it names
  // has actually happened" shape as `submittedAt` above. Re-set (not
  // preserved) on every re-grade, so it always reflects the most recent
  // grading action.
  @Column({ name: 'graded_at', type: 'timestamp', nullable: true })
  gradedAt: Date | null;

  // The teacher (User.id) who most recently graded this submission --
  // not necessarily the same teacher who posted the homework (see
  // TeacherService's own "assignment-scoped, not creator-scoped"
  // reasoning for why any assigned teacher may act on a submission).
  // Stored as a plain uuid column, not a ManyToOne relation, same
  // "store the id, no relation needed for a field only ever read back
  // as-is" shape used elsewhere for ids that are never joined through.
  @Column({ name: 'graded_by_user_id', type: 'uuid', nullable: true })
  gradedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
