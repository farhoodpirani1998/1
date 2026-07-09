import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ length: 50 })
  title: string; // e.g. "پایه هفتم"
}
