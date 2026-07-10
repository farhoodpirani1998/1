import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
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
@Entity('teacher_assignments')
@Unique('uq_teacher_assignment', ['teacherId', 'gradeId', 'subjectId'])
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

  @ManyToOne(() => Subject, { nullable: false })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
