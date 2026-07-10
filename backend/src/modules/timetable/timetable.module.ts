import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimetableEntry } from './entities/timetable-entry.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';

// Phase 5K: Timetable Foundation.
//
// Deliberately does not import TeacherModule or ParentModule: both need
// TimetableService (TeacherModule directly, for GET /teacher/timetable;
// ParentModule directly, for GET /parent/students/:id/timetable), so
// importing either back here would create a cycle. Declares its own
// narrow TypeORM repos for AcademicYear/Grade/Subject/User/Student/
// ParentStudent/TeacherAssignment instead -- same shape
// StudentDocumentsModule / StudentAssessmentsModule already use for the
// same reason, and the same "declare narrow repos rather than import the
// owning module" choice TeacherModule itself already made for Grade and
// Subject.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimetableEntry,
      AcademicYear,
      Grade,
      Subject,
      User,
      Student,
      ParentStudent,
      TeacherAssignment,
    ]),
  ],
  controllers: [TimetableController],
  providers: [TimetableService],
  exports: [TimetableService],
})
export class TimetableModule {}
