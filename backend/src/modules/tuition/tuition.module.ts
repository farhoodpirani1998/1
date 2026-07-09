import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TuitionPlan } from './entities/tuition-plan.entity';
import { Installment } from './entities/installment.entity';
import { Payment } from './entities/payment.entity';
import { Student } from '../students/entities/student.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { User } from '../users/entities/user.entity';
import { LedgerModule } from '../ledger/ledger.module';

import { TuitionPlansController } from './tuition-plans/tuition-plans.controller';
import { TuitionPlansService } from './tuition-plans/tuition-plans.service';
import { InstallmentsController } from './installments/installments.controller';
import { InstallmentsService } from './installments/installments.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TuitionPlan,
      Installment,
      Payment,
      Student,
      AcademicYear,
      User,
    ]),
    LedgerModule,
  ],
  controllers: [
    TuitionPlansController,
    InstallmentsController,
    PaymentsController,
  ],
  providers: [TuitionPlansService, InstallmentsService, PaymentsService],
  // Exported so the scheduler module can call
  // installmentsService.markOverdueInstallments() from its cron job.
  exports: [InstallmentsService],
})
export class TuitionModule {}
