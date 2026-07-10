import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Assessment } from '../student-assessments/entities/assessment.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { ReportsModule } from '../reports/reports.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// Phase 5J: Analytics Dashboard Foundation.
//
// Reaches ReportsModule (ReportsService.overdueSummary/monthlyIncome),
// AttendanceModule (AttendanceService.findByDate), and AnnouncementsModule
// (AnnouncementsService.findAllForSchool) for numbers those modules
// already compute, and declares its own narrow TypeORM repos
// (Student/Attendance/Assessment/Payment/Installment/TuitionPlan) for the
// school-wide aggregate reads none of them expose -- same "own repos for
// reads you need directly, don't modify the owning module" convention
// StudentDocumentsModule / StudentProfileModule already use. Does not
// import StudentAssessmentsModule: only buildReportCard (a pure function
// exported from its dto file) is needed, not AssessmentsService itself.
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Attendance, Assessment, Payment, Installment, TuitionPlan]),
    ReportsModule,
    AttendanceModule,
    AnnouncementsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
