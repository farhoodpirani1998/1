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
import { Grade } from '../../grades/entities/grade.entity';
import { Subject } from '../../student-assessments/entities/subject.entity';

// One row per (teacher, grade, subject) the teacher has been assigned to
// teach — see migration 1737000000000-TeacherAssignments for the table
// definition and the reasoning behind this granularity. A teacher may
// have several rows (multiple subjects, multiple grades, or both); every
// /teacher/* read or write is scoped to only the rows that belong to the
// caller (see TeacherService), the same way ParentStudent scopes
// /parent/* to only a parent's own linked children.
// No @Unique() decorator here: enforcement is via the two partial unique
// indexes created in TeacherAssignmentSubjectOptional1737800000000
// (uq_teacher_assignment_subject / uq_teacher_assignment_no_subject) --
// a single column-list UNIQUE can't express "unique only when subject_id
// IS NULL" vs "...IS NOT NULL" the way a partial index can.
@Entity('teacher_assignments')
export class TeacherAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => Grade, { nullable: false })
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;

  @Column({ name: 'grade_id' })
  gradeId: string;

  // Nullable: see migration TeacherAssignmentSubjectOptional1737800000000.
  // A NULL subject means the teacher covers every subject for this grade
  // -- the shape elementary grades (پایه ابتدایی) need, since they don't
  // split instruction by subject the way older grades do.
  @ManyToOne(() => Subject, { nullable: true })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject | null;

  @Column({ name: 'subject_id', nullable: true })
  subjectId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
