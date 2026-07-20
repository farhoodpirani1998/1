import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentUser } from '../students/entities/student-user.entity';
import { Student } from '../students/entities/student.entity';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
// ADR-001 Task 4C: GET /student/attendance is served by AttendanceService
// -- imported directly (inject AttendanceService, no repo reuse), the same
// "import AttendanceModule, don't reach into its repos" pattern
// ParentModule/TeacherModule already use.
import { AttendanceModule } from '../attendance/attendance.module';
// ADR-001 Task 4D: GET /student/assessments and GET /student/report-card
// are served by AssessmentsService -- imported directly (inject
// AssessmentsService, no repo reuse), same "import StudentAssessmentsModule,
// don't reach into its repos" pattern used for AttendanceModule above and
// already used by ParentModule/TeacherModule.
import { StudentAssessmentsModule } from '../student-assessments/student-assessments.module';
// ADR-001 Task 4E: GET /student/homework is served by HomeworkService and
// HomeworkSubmissionService -- imported directly (inject both, no repo
// reuse), same "import the owning module, don't reach into its repos"
// pattern used for AttendanceModule/StudentAssessmentsModule above.
import { HomeworkModule } from '../homework/homework.module';
// ADR-001 Task 4F: GET /student/announcements is served by
// AnnouncementsService -- imported directly (inject AnnouncementsService,
// no repo reuse), same "import the owning module, don't reach into its
// repos" pattern used for AttendanceModule/StudentAssessmentsModule/
// HomeworkModule above, and the same module ParentModule/TeacherModule
// already import for their own GET /parent|teacher/announcements routes.
import { AnnouncementsModule } from '../announcements/announcements.module';
// ADR-001 Task 4G: GET /student/documents is served by
// StudentDocumentsService -- imported directly (inject
// StudentDocumentsService, no repo reuse), same "import the owning
// module, don't reach into its repos" pattern used for
// AttendanceModule/StudentAssessmentsModule/HomeworkModule/
// AnnouncementsModule above, and the same module ParentModule already
// imports for its own GET /parent/students/:id/documents route.
import { StudentDocumentsModule } from '../student-documents/student-documents.module';
// ADR-001 Task 4H: GET /student/timetable is served by TimetableService --
// imported directly (inject TimetableService, no repo reuse), same
// "import the owning module, don't reach into its repos" pattern used for
// every other /student/* read, and the same module ParentModule already
// imports for its own GET /parent/students/:id/timetable route.
import { TimetableModule } from '../timetable/timetable.module';

// ADR-001 Task 4A-1/4A-2: self-service /student/* portal (Role.STUDENT,
// see roles.enum.ts). Declares its own narrow TypeORM repos for the two
// entities it needs (StudentUser, Student) — same "don't import
// StudentsModule back just to reuse its repos" shape TeacherModule/
// ParentModule already use — rather than importing StudentsModule, which
// also avoids any risk of a circular dependency down the line.
@Module({
  imports: [
    TypeOrmModule.forFeature([StudentUser, Student]),
    AttendanceModule,
    StudentAssessmentsModule,
    HomeworkModule,
    AnnouncementsModule,
    StudentDocumentsModule,
    TimetableModule,
  ],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
