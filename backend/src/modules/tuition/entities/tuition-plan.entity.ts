import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Installment } from './installment.entity';

@Entity('tuition_plans')
export class TuitionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @Column({ name: 'base_amount', type: 'numeric', precision: 14, scale: 0 })
  baseAmount: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 14,
    scale: 0,
    default: 0,
  })
  discountAmount: number;

  @Column({ name: 'discount_reason', type: 'varchar', length: 200, nullable: true })
  discountReason: string | null;

  @Column({ name: 'final_amount', type: 'numeric', precision: 14, scale: 0 })
  finalAmount: number;

  @OneToMany(() => Installment, (installment) => installment.tuitionPlan)
  installments: Installment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
