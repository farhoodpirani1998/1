import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentDocument } from './entities/student-document.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';

const RECENT_DOCUMENTS_LIMIT = 10;

@Injectable()
export class StudentDocumentsService {
  constructor(
    @InjectRepository(StudentDocument)
    private readonly documentRepo: Repository<StudentDocument>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
  ) {}

  /**
   * Attaches a new document reference to a student. Tenant check mirrors
   * AssessmentsService.record()'s studentId check: fetched by id +
   * schoolId together, so a wrong-tenant id 404s exactly like a
   * nonexistent one. No file storage happens here -- fileUrl is stored
   * exactly as given (see StudentDocument / CreateStudentDocumentDto).
   */
  async create(
    studentId: string,
    dto: CreateStudentDocumentDto,
    schoolId: string,
    uploadedById: string,
  ): Promise<StudentDocument> {
    await this.assertStudentInSchool(studentId, schoolId);

    const document = this.documentRepo.create({
      schoolId,
      studentId,
      title: dto.title,
      documentType: dto.documentType,
      fileUrl: dto.fileUrl,
      description: dto.description ?? null,
      uploadedById,
    });
    return this.documentRepo.save(document);
  }

  /**
   * Full document list for one student, most recent first. Tenant check
   * follows AssessmentsService.findByStudent()'s shape: a single
   * schoolId-scoped existence check, so a wrong-tenant id 404s exactly
   * like a nonexistent one.
   */
  async findByStudent(studentId: string, schoolId: string): Promise<StudentDocument[]> {
    await this.assertStudentInSchool(studentId, schoolId);
    return this.documentRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Parent-side access: same "linked child only" rule as every other
   * /parent/students/:id/* route (ParentService.findMyStudent,
   * AssessmentsService.findForParent) -- 404, never 403, so a parent
   * probing an id can't tell "doesn't exist" from "exists but isn't
   * yours". Checked here directly (rather than delegating to
   * ParentService) for the same reason AssessmentsService does its own
   * inline check: StudentDocumentsModule is imported BY ParentModule, so
   * importing ParentModule back here would create a cycle.
   */
  async findForParent(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<StudentDocument[]> {
    await this.assertParentLinked(studentId, parentId);
    return this.findByStudent(studentId, schoolId);
  }

  /**
   * Removes one document. Tenant check mirrors
   * AnnouncementsService.delete()'s shape: fetched by id + schoolId
   * together, so a wrong-tenant id 404s exactly like a nonexistent one --
   * a caller can never learn "that id exists, just not here" from the
   * response.
   */
  async remove(id: string, schoolId: string): Promise<void> {
    const document = await this.documentRepo.findOne({ where: { id, schoolId } });
    if (!document) {
      throw new NotFoundException('سند یافت نشد');
    }
    await this.documentRepo.remove(document);
  }

  /**
   * Used only by StudentProfileService to populate the profile's
   * documents section. The student's tenant/link check has already run in
   * StudentProfileService by the time this is called, so this is a plain,
   * capped read with no NotFound path of its own -- same convention as
   * AttendanceService.findRecentForStudent /
   * AssessmentsService.findRecentForStudent.
   */
  async findRecentForStudent(
    studentId: string,
    limit: number = RECENT_DOCUMENTS_LIMIT,
  ): Promise<StudentDocument[]> {
    return this.documentRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async assertStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
  }

  private async assertParentLinked(studentId: string, parentId: string): Promise<void> {
    const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
    if (!link) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
  }
}
