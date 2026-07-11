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

// One row per homework/assignment a teacher posts for one (grade, subject)
// within one academic year -- see migration 1737400000000-Homework for the
// table definition. Unlike Announcement (one-shot, never corrected in
// place) this *can* be corrected via PUT /teacher/homework/:id, same
// reasoning TimetableEntry carries both createdAt and updatedAt.
//
// school_id is stored directly on the row (not derived only through a
// join), same reasoning attendance/student_assessments/announcements/
// timetable_entries already store their own tenant-scoping column rather
// than requiring a join for every tenant-scoped read.
@Entity('homework')
export class Homework {
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

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  // Stored as a plain 'YYYY-MM-DD' string, same "date as a plain string,
  // not a Date object" convention AcademicYear.startDate / Installment.dueDate
  // already use.
  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  // Phase 5L does not implement file storage/upload -- the caller supplies
  // the already-hosted location of the file, same "store the reference,
  // not the bytes" shape as StudentDocument.fileUrl. Nullable: an
  // attachment is optional.
  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
