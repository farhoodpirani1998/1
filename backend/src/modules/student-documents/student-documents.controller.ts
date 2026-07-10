import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { StudentDocumentsService } from './student-documents.service';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
import { toStudentDocumentView } from './dto/student-document-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Phase 5I: Student Document Management.
//
// Mounted under 'students' (not its own 'student-documents' segment) so
// the routes match the rest of the student sub-resource surface --
// same shape as GET /students/:id/profile living on StudentsController
// even though it's served by a different service.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentDocumentsController {
  constructor(private readonly studentDocumentsService: StudentDocumentsService) {}

  // Uploading a reference: same role pair as POST /assessments
  // (school_admin, staff). accountant, being financial-only elsewhere in
  // the app, is not granted a write here; 'parent' is never granted this
  // route, same as every staff-facing endpoint outside /parent/*.
  @Post(':id/documents')
  @Roles('school_admin', 'staff')
  async create(
    @Param('id') studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const document = await this.studentDocumentsService.create(
      studentId,
      dto,
      user.schoolId,
      user.id,
    );
    return toStudentDocumentView(document);
  }

  // Read access matches GET /assessments/student/:id (school_admin,
  // accountant, staff can all see a student's own record).
  @Get(':id/documents')
  @Roles('school_admin', 'accountant', 'staff')
  async findByStudent(@Param('id') studentId: string, @CurrentUser('schoolId') schoolId: string) {
    const documents = await this.studentDocumentsService.findByStudent(studentId, schoolId);
    return documents.map(toStudentDocumentView);
  }
}

// Deletion lives on its own top-level 'documents' resource (id alone,
// no student id in the path) -- same "flat delete-by-id" shape as
// DELETE /announcements/:id, since the document's own id is already
// globally unique and its tenant is re-checked from the token, not the
// URL.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly studentDocumentsService: StudentDocumentsService) {}

  @Delete(':id')
  @Roles('school_admin', 'staff')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.studentDocumentsService.remove(id, schoolId);
  }
}
