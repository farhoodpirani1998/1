import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Phase 5F: an academic *subject* (e.g. "ریاضی", "علوم") that assessments
// are recorded against. Deliberately separate from modules/grades' Grade
// entity, which represents an academic *grade level* (e.g. "پایه هفتم") --
// same name collision risk the task called out, avoided by not reusing
// the word "grade" anywhere in this module. Modeled the same shape as
// Grade itself (school-scoped, id + title, no further nesting) since a
// subject is exactly that same kind of small per-school reference list.
@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string; // e.g. "ریاضی"
}
