import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Homework } from './entities/homework.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';
import { HomeworkSubmissionService } from './homework-submission.service';

// Phase 5L: Homework & Assignments.
//
// Deliberately does not import TeacherModule or ParentModule: both need
// HomeworkService (TeacherModule directly, for the /teacher/homework CRUD
// surface; ParentModule directly, for
// GET /parent/students/:id/homework), so importing either back here would
// create a cycle. Declares its own narrow TypeORM repos for
// AcademicYear/Grade/Subject/Student/ParentStudent/TeacherAssignment
// instead -- same shape TimetableModule / StudentDocumentsModule already
// use for the same reason.
//
// Sprint A.3.1: HomeworkSubmission is registered here (not a separate
// module) for the same reason TeacherAssignment lives in the teacher
// module rather than its own -- it's a child concept of Homework, not an
// independent domain, and every future consumer (a
// HomeworkSubmissionsService, teacher/parent-facing read routes) will
// need HomeworkService's existing tenant/assignment-scoping context
// anyway.
//
// Sprint A.3.2: HomeworkSubmissionService is the "future consumer"
// mentioned above -- a same-module provider (not exported-and-reimported
// from elsewhere) so it can inject HomeworkService directly, the same
// "reuse the sibling service, don't re-derive its tenant checks" shape
// TeacherService already uses for AttendanceService/AssessmentsService.
// Exported alongside HomeworkService for the same reason HomeworkService
// itself is exported: TeacherModule/ParentModule will need it once a
// later sprint adds the teacher/student-facing submission routes. No
// controller is added in this sprint -- see the service's own header
// comment.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Homework,
      HomeworkSubmission,
      AcademicYear,
      Grade,
      Subject,
      Student,
      ParentStudent,
      TeacherAssignment,
    ]),
  ],
  controllers: [HomeworkController],
  providers: [HomeworkService, HomeworkSubmissionService],
  exports: [HomeworkService, HomeworkSubmissionService],
})
export class HomeworkModule {}
