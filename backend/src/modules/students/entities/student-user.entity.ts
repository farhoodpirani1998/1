import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Student } from './student.entity';

// One-to-one link between a student-role user (users.role = 'student')
// and the single Student record that login is allowed to see. This is
// the "future StudentUser 1:1 link" referenced in
// common/authorization/roles.enum.ts (ADR-001 §9) and mirrors the shape
// of ParentStudent (modules/parent/entities/parent-student.entity.ts)
// and FounderSchool (modules/founder/entities/founder-school.entity.ts)
// -- a plain join table (id + two FKs + created_at) rather than folding
// the link onto either existing table, so both `students` and `users`
// stay untouched.
//
// Unlike ParentStudent (many parents <-> many students) and FounderSchool
// (one founder <-> many schools), this relationship is 1:1 in both
// directions: one user account maps to at most one student, and one
// student maps to at most one login. That is enforced with two single-
// column unique constraints (uq_student_users_student, on studentId, and
// uq_student_users_user, on userId) rather than the composite
// (parent_id, student_id)-style unique the many-to-many join tables use --
// a composite unique alone would still allow the same student to be
// linked to several different user accounts, which is exactly what this
// table must prevent. See migration 1738300000000-StudentUsers for the
// table definition.
@Entity('student_users')
@Unique('uq_student_users_student', ['studentId'])
@Unique('uq_student_users_user', ['userId'])
export class StudentUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
