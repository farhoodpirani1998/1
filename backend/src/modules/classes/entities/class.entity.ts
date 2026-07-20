import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';

// One row per physical class/section within a grade, for one academic
// year -- e.g. "هفتم-الف" and "هفتم-ب" are two separate Class rows under
// the same Grade for the same AcademicYear.
//
// Added because Student/TeacherAssignment previously only went as
// granular as Grade: a school with two sections per grade had no way to
// tell them apart, so every teacher assigned to that grade (and every
// roster read scoped by grade) saw *all* students of the grade
// regardless of which physical class they were actually in. See
// migration CreateClasses for the table definition.
//
// schoolId is stored directly on the row (not derived only through the
// grade/academicYear join), same reasoning attendance/student_assessments/
// teacher_assignments already store their own tenant-scoping column
// rather than requiring a join for every tenant-scoped read.
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

  @Column({ type: 'varchar', length: 50 })
  title: string; // e.g. "الف", "ب"

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
