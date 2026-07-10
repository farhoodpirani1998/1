import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Homework } from './entities/homework.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';

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
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Homework,
      AcademicYear,
      Grade,
      Subject,
      Student,
      ParentStudent,
      TeacherAssignment,
    ]),
  ],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
