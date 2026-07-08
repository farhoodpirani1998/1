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

  // A class encodes both the grade ("پایه هفتم") and the academic year
  // ("۱۴۰۴-۱۴۰۵") it belongs to, so a student no longer needs separate
  // grade_id/academic_year_id columns — both are reached via class.
  // Nullable because a freshly transferred-in student has no class yet
  // until the receiving school assigns one.
  @ManyToOne(() => Class, { nullable: true })
  @JoinColumn({ name: 'class_id' })
  class: Class | null;

  @Column({ name: 'class_id', nullable: true })
  classId: string | null;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'national_id', length: 20, nullable: true })
  nationalId: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, default: StudentStatus.ACTIVE })
  status: StudentStatus;

  @Column({ name: 'enrollment_date', type: 'date', nullable: true })
  enrollmentDate: string | null;

  // Set when this student arrived via a cross-school transfer, for a
  // simple audit trail ("where did this student come from").
  @Column({ name: 'transferred_from_school_id', nullable: true })
  transferredFromSchoolId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
