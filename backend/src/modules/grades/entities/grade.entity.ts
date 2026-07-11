import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 50 })
  title: string; // e.g. "پایه هفتم"
}
