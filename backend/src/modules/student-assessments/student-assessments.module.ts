import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from './entities/assessment.entity';
import { Subject } from './entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

// Phase 5F: Student Assessment & Report Cards.
//
// Deliberately does not import StudentsModule or ParentModule: both need
// AssessmentsService (ParentModule directly, for
// GET /parent/students/:id/assessments and .../report-card;
// StudentsModule indirectly, via StudentProfileModule's assessments
// summary), so importing either back here would create a cycle. Declares
// its own narrow TypeORM repos for the student/parent-link reads it needs
// directly -- same shape AttendanceModule already uses for the same
// reason.
@Module({
  imports: [TypeOrmModule.forFeature([Assessment, Subject, Student, ParentStudent])],
  controllers: [SubjectsController, AssessmentsController],
  providers: [SubjectsService, AssessmentsService],
  exports: [AssessmentsService, SubjectsService],
})
export class StudentAssessmentsModule {}
