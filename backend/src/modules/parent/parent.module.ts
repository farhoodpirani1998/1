import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
// Phase 5D: GET /parent/students/:id/profile is served by StudentProfileService.
import { StudentProfileModule } from '../students/profile/student-profile.module';
// Phase 5E: GET /parent/students/:id/attendance is served by AttendanceService.
import { AttendanceModule } from '../attendance/attendance.module';
// Phase 5F: GET /parent/students/:id/assessments and .../report-card are
// served by AssessmentsService.
import { StudentAssessmentsModule } from '../student-assessments/student-assessments.module';
// Phase 5H: GET /parent/announcements is served by AnnouncementsService.
import { AnnouncementsModule } from '../announcements/announcements.module';
// Phase 5I: GET /parent/students/:id/documents is served by
// StudentDocumentsService.
import { StudentDocumentsModule } from '../student-documents/student-documents.module';
// Phase 5K: GET /parent/students/:id/timetable is served by TimetableService.
import { TimetableModule } from '../timetable/timetable.module';
// Phase 5L: GET /parent/students/:id/homework is served by HomeworkService.
import { HomeworkModule } from '../homework/homework.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParentStudent,
      User,
      Student,
      TuitionPlan,
      Installment,
      Payment,
      // Phase 5C: parent notification list/mark-read reads directly from
      // the same `notifications` table NotificationsModule owns, via its
      // own repo injection -- same convention this module already used
      // for TuitionPlan/Installment/Payment (query-builder + tenant
      // checks live in ParentService, not delegated to another
      // module's service).
      Notification,
    ]),
    StudentProfileModule,
    AttendanceModule,
    StudentAssessmentsModule,
    AnnouncementsModule,
    StudentDocumentsModule,
    TimetableModule,
    HomeworkModule,
  ],
  controllers: [ParentController],
  providers: [ParentService],
  exports: [ParentService],
})
export class ParentModule {}
