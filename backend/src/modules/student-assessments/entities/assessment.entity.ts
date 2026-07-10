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
import { Subject } from './subject.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { User } from '../../users/entities/user.entity';

// Two-term academic calendar, the same convention already used for
// AcademicYear.title ("۱۴۰۴-۱۴۰۵" spanning one school year split in half).
// Kept as a small closed enum, same shape as AttendanceStatus, rather than
// a free-text term name -- report-card grouping (AssessmentsService's
// report-card builder) depends on there being a fixed, known set of terms
// to group by.
export enum AssessmentTerm {
  FIRST_TERM = 'first_term',
  SECOND_TERM = 'second_term',
}

// One row per (student, subject, academic year, term) -- see the unique
// index in the StudentAssessments migration,
// uq_assessment_student_subject_year_term. AssessmentsService upserts on
// that tuple rather than erroring on a resubmission, same
// "resubmitting corrects rather than duplicates" shape as
// Attendance/uq_attendance_student_date.
//
// Deliberately named `Assessment` (table `student_assessments`), not
// `Grade`/`GradeRecord` -- modules/grades already owns that word for
// academic grade *levels* (see Grade). Reusing it here for a *score*
// would make every future "grade" reference in this codebase ambiguous.
@Entity('student_assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => Subject, { nullable: false })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  // Derived from the student's own record at the time of recording (same
  // reasoning as Attendance.academicYearId) rather than accepted from the
  // request body, so it can never drift from the student it's attached to
  // and a later grade/year promotion doesn't retroactively change which
  // year an assessment is reported under.
  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'varchar', length: 20 })
  term: AssessmentTerm;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  score: number;

  // Out of how many points `score` was recorded, default 20 (the standard
  // Iranian school scale) -- kept per-row rather than a global constant so
  // a subject scored out of a different scale (e.g. a 100-point project)
  // can still be recorded and normalized correctly in the report card.
  @Column({ name: 'max_score', type: 'numeric', precision: 5, scale: 2, default: 20 })
  maxScore: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy: User | null;

  @Column({ name: 'recorded_by', nullable: true })
  recordedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
