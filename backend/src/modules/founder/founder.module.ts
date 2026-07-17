import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FounderSchool } from './entities/founder-school.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { FounderController } from './founder.controller';
import { FounderService } from './founder.service';
import { StudentsModule } from '../students/students.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportsModule } from '../reports/reports.module';

// Phase 5O: Founder (مؤسس) Portal.
//
// Imports StudentsModule/AnalyticsModule/ReportsModule to reuse
// StudentsService.findWithFilters() / AnalyticsService.getDashboard() /
// ReportsService.overdueSummary()+debtorStudents() directly —
// FounderService adds only the "does this founder own this school" gate
// in front of them, never reimplements their tenant checks or business
// rules. Declares its own narrow repos for School/User/Student/
// TeacherAssignment/TuitionPlan/Installment (the same shape
// AnalyticsModule itself uses for reads none of those services already
// expose: school list, teacher/staff directories, cross-school finance
// totals) rather than widening any of those modules' public surface for
// this one caller.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FounderSchool,
      School,
      User,
      Student,
      TeacherAssignment,
      TuitionPlan,
      Installment,
    ]),
    StudentsModule,
    AnalyticsModule,
    ReportsModule,
  ],
  controllers: [FounderController],
  providers: [FounderService],
})
export class FounderModule {}
