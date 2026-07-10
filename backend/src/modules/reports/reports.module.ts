import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from '../tuition/entities/installment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Student } from '../students/entities/student.entity';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Installment, TuitionPlan, Payment, Student, LedgerEntry]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  // Phase 5D: StudentProfileModule reuses studentStatement() for the
  // profile's tuition/payment summary instead of re-deriving totals.
  exports: [ReportsService],
})
export class ReportsModule {}
