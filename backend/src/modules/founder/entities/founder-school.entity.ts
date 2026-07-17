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
import { School } from '../../schools/entities/school.entity';

// Many-to-many join between a founder-role user and the school(s) they
// own: one founder can own several schools, and (in principle) a school
// could be linked to more than one founder login. See migration
// 1737600000000-FounderSchools for the table definition — same shape as
// ParentStudent (modules/parent/entities/parent-student.entity.ts).
@Entity('founder_schools')
@Unique('uq_founder_school', ['founderId', 'schoolId'])
export class FounderSchool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'founder_id' })
  founder: User;

  @Column({ name: 'founder_id' })
  founderId: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
