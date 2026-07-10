import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { StudentDocumentsController, DocumentsController } from './student-documents.controller';
import { StudentDocumentsService } from './student-documents.service';

// Phase 5I: Student Document Management.
//
// Deliberately does not import StudentsModule or ParentModule: both need
// StudentDocumentsService (ParentModule directly, for
// GET /parent/students/:id/documents; StudentsModule indirectly, via
// StudentProfileModule's documents summary), so importing either back
// here would create a cycle. Declares its own narrow TypeORM repos for
// the student/parent-link reads it needs directly -- same shape
// StudentAssessmentsModule / AttendanceModule already use for the same
// reason.
@Module({
  imports: [TypeOrmModule.forFeature([StudentDocument, Student, ParentStudent])],
  controllers: [StudentDocumentsController, DocumentsController],
  providers: [StudentDocumentsService],
  exports: [StudentDocumentsService],
})
export class StudentDocumentsModule {}
