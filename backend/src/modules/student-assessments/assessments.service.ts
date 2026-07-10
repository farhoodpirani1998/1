import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from './entities/assessment.entity';
import { Subject } from './entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { ReportCardView, buildReportCard } from './dto/report-card-view.dto';

const DEFAULT_MAX_SCORE = 20;

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
  ) {}

  /**
   * Records (or corrects) one student's score for one subject/term.
   *
   * Tenant enforcement mirrors AttendanceService.record()'s
   * studentId/subjectId checks: each referenced row is fetched by id
   * alone, then its schoolId is compared to the caller's -- NotFound if
   * it doesn't exist at all, Forbidden if it exists but belongs to
   * another school.
   *
   * Upserts on (studentId, subjectId, academicYearId, term) -- see
   * uq_assessment_student_subject_year_term in the StudentAssessments
   * migration -- so correcting a previously-entered score is a second
   * POST, not a 409/duplicate row. academicYearId is always derived from
   * the student's own current record, never accepted from the request
   * body, so it can never drift from the student it's attached to.
   */
  async record(
    dto: CreateAssessmentDto,
    schoolId: string,
    recordedById: string,
  ): Promise<Assessment> {
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
    }

    const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
    if (!subject) {
      throw new NotFoundException('درس یافت نشد');
    }
    if (subject.schoolId !== schoolId) {
      throw new ForbiddenException('این درس متعلق به مدرسه دیگری است');
    }

    const maxScore = dto.maxScore ?? DEFAULT_MAX_SCORE;
    if (dto.score > maxScore) {
      throw new BadRequestException('نمره نمی‌تواند بیشتر از حداکثر نمره باشد');
    }

    const existing = await this.assessmentRepo.findOne({
      where: {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        academicYearId: student.academicYearId,
        term: dto.term,
      },
    });

    if (existing) {
      existing.score = dto.score;
      existing.maxScore = maxScore;
      existing.note = dto.note ?? null;
      existing.recordedById = recordedById;
      return this.assessmentRepo.save(existing);
    }

    const assessment = this.assessmentRepo.create({
      schoolId,
      studentId: dto.studentId,
      subjectId: dto.subjectId,
      academicYearId: student.academicYearId,
      term: dto.term,
      score: dto.score,
      maxScore,
      note: dto.note ?? null,
      recordedById,
    });
    return this.assessmentRepo.save(assessment);
  }

  /**
   * Full assessment history for one student, most recent first.
   * Tenant check follows AttendanceService.findByStudent()'s shape: a
   * single schoolId-scoped existence check, so a wrong-tenant id 404s
   * exactly like a nonexistent one.
   */
  async findByStudent(studentId: string, schoolId: string): Promise<Assessment[]> {
    await this.assertStudentInSchool(studentId, schoolId);
    return this.assessmentRepo.find({
      where: { studentId },
      relations: ['subject'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * The report card for one student -- every recorded assessment for
   * their current record, grouped and averaged by term (see
   * buildReportCard). Same tenant check as findByStudent(), reused rather
   * than duplicated.
   */
  async getReportCard(studentId: string, schoolId: string): Promise<ReportCardView> {
    await this.assertStudentInSchool(studentId, schoolId);
    const assessments = await this.assessmentRepo.find({
      where: { studentId },
      relations: ['subject'],
      order: { term: 'ASC' },
    });
    return buildReportCard(studentId, assessments);
  }

  /**
   * Parent-side access: same "linked child only" rule as every other
   * /parent/students/:id/* route (ParentService.findMyStudent,
   * AttendanceService.findForParent) -- 404, never 403, so a parent
   * probing an id can't tell "doesn't exist" from "exists but isn't
   * yours". Checked here directly (rather than delegating to
   * ParentService) for the same reason AttendanceService does its own
   * inline check: StudentAssessmentsModule is imported BY ParentModule,
   * so importing ParentModule back here would create a cycle.
   */
  async findForParent(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<Assessment[]> {
    await this.assertParentLinked(studentId, parentId);
    return this.findByStudent(studentId, schoolId);
  }

  async getReportCardForParent(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<ReportCardView> {
    await this.assertParentLinked(studentId, parentId);
    return this.getReportCard(studentId, schoolId);
  }

  /**
   * Used only by StudentProfileService to populate the profile's
   * assessments section. The student's tenant/link check has already run
   * in StudentProfileService by the time this is called, so this is a
   * plain, capped read with no NotFound path of its own -- same
   * convention as AttendanceService.findRecentForStudent.
   */
  async findRecentForStudent(studentId: string, limit: number): Promise<Assessment[]> {
    return this.assessmentRepo.find({
      where: { studentId },
      relations: ['subject'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Same as findRecentForStudent, but unbounded -- used only by
   * StudentProfileService to build the profile's report-summary section,
   * which needs every assessment (to average correctly), not just the
   * most recent handful.
   */
  async findAllForStudent(studentId: string): Promise<Assessment[]> {
    return this.assessmentRepo.find({
      where: { studentId },
      relations: ['subject'],
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
