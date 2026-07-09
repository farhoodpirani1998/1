import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => Grade, { nullable: false })
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;

  @Column({ name: 'grade_id' })
  gradeId: string;

  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @Column({ length: 50 })
  title: string; // e.g. "الف", "۲" — combined with grade.title gives "هفتم / ۲"

  @Column({ name: 'teacher_name', length: 150, nullable: true })
  teacherName: string | null;

  @Column({ nullable: true })
  capacity: number | null;
}
