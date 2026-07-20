import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Guardian } from './guardian.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { Class } from '../../classes/entities/class.entity';

export enum StudentStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  GRADUATED = 'graduated',
}

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => Guardian, { nullable: true })
  @JoinColumn({ name: 'guardian_id' })
  guardian: Guardian | null;

  @Column({ name: 'guardian_id', nullable: true })
  guardianId: string | null;

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

  // Nullable: which section/class of the grade this student is placed
  // in, for the same academicYearId this row already carries. NULL means
  // "not yet placed in a section" -- schools that don't split a grade
  // into sections at all simply never set this. See migration
  // AddClassIdToStudents for the reasoning (fixing the bug where two
  // sections of one grade had no way to be told apart).
  @ManyToOne(() => Class, { nullable: true })
  @JoinColumn({ name: 'class_id' })
  class: Class | null;

  @Column({ name: 'class_id', nullable: true })
  classId: string | null;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'national_id', type: 'varchar', length: 20, nullable: true })
  nationalId: string | null;

  @Column({ type: 'varchar', length: 20, default: StudentStatus.ACTIVE })
  status: StudentStatus;

  @Column({ name: 'enrollment_date', type: 'date', nullable: true })
  enrollmentDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
