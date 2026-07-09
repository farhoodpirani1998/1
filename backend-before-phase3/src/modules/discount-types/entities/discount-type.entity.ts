import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('discount_types')
export class DiscountType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ length: 100 })
  title: string; // e.g. "چند فرزندی", "نیازمند", "صلاحدید مدیر"

  // A starting point only — the actual amount on a tuition plan can always
  // be overridden higher or lower (e.g. "مدیر صلاح بدونه درصد بیشتری بده").
  @Column({ name: 'default_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  defaultPercent: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
