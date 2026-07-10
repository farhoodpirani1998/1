import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../entities/student.entity';
import { ParentStudent } from '../../parent/entities/parent-student.entity';
import { User } from '../../users/entities/user.entity';
import { ReportsModule } from '../../reports/reports.module';
import { AttendanceModule } from '../../attendance/attendance.module';
import { StudentAssessmentsModule } from '../../student-assessments/student-assessments.module';
// Phase 5I: documents summary is populated via StudentDocumentsService.
import { StudentDocumentsModule } from '../../student-documents/student-documents.module';
// Phase 5L: homework summary is populated via HomeworkService.
import { HomeworkModule } from '../../homework/homework.module';
import { StudentProfileService } from './student-profile.service';

// Deliberately does not import StudentsModule or ParentModule: those two
// modules' controllers (StudentsController, ParentController) are the
// consumers of StudentProfileService, so importing either back here would
// create a cycle. Instead this module reaches ReportsModule (for
// ReportsService) and AttendanceModule (for AttendanceService, Phase 5E's
// attendance summary), and declares its own narrow TypeOrm repos for the
// student/parent-link/user reads it needs directly.
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, ParentStudent, User]),
    ReportsModule,
    AttendanceModule,
    StudentAssessmentsModule,
    StudentDocumentsModule,
    HomeworkModule,
  ],
  providers: [StudentProfileService],
  exports: [StudentProfileService],
})
export class StudentProfileModule {}
