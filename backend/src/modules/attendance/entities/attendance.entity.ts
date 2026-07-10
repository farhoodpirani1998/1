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
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { User } from '../../users/entities/user.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

// One row per student per calendar day (see the unique index in the
// Attendance migration, uq_attendance_student_date). AttendanceService
// upserts on that pair rather than erroring on a second submission for the
// same day -- same "resubmitting corrects rather than duplicates" shape as
// GuardiansService.findOrCreate() / ParentService.link().
@Entity('attendance')
export class Attendance {
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

  // Derived from the student's own record at the time of marking (same as
  // how the student itself is scoped to one academic year) rather than
  // accepted from the request body -- avoids a client sending an
  // academicYearId that doesn't match the student it's attached to.
  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  status: AttendanceStatus;

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
