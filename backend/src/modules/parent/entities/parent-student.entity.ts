import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Student } from '../../students/entities/student.entity';

// Many-to-many join between a parent-role user and the student(s) they may
// view: one parent can have several children, one student can have several
// parents (e.g. both mother and father each get their own login). See
// migration 1736600000000-ParentPortal for the table definition.
@Entity('parent_students')
@Unique('uq_parent_student', ['parentId', 'studentId'])
export class ParentStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'parent_id' })
  parent: User;

  @Column({ name: 'parent_id' })
  parentId: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
