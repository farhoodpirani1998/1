import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Assessment } from './entities/assessment.entity';
import { Subject } from './entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { ReportCardView, buildReportCard } from './dto/report-card-view.dto';
import {
  normalizePagination,
  wantsPaginatedResponse,
  type PaginationParams,
  type PaginatedResult,
} from '../../common/utils/pagination';

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
  async findByStudent(
    studentId: string,
    schoolId: string,
    query: PaginationParams = {},
  ): Promise<Assessment[] | PaginatedResult<Assessment>> {
    await this.assertStudentInSchool(studentId, schoolId);
    const { page, limit, skip } = normalizePagination(query);
    const [data, total] = await this.assessmentRepo.findAndCount({
      where: { studentId },
      relations: ['subject'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    if (wantsPaginatedResponse(query)) {
      return { data, total, page, limit };
    }
    return data;
  }

  /**
   * Sprint A.2: assessments across an arbitrary set of (grade, class,
   * subject) scopes, most recent first -- backs GET /teacher/assessments.
   * `entries` is pre-resolved by the caller (TeacherService, mirroring
   * the same "start from the caller's own assignments" shape
   * AttendanceService.findByDateForScope's `scope` param is fed by) into
   * one tuple per distinct assignment: a null `classId` means "every
   * section of that grade" (matches assignmentCoversStudent's
   * whole-grade rule), a null `subjectId` means "every subject" (the
   * elementary-teacher case already handled by recordAssessment above).
   * Each entry is its own AND-bracket (grade/class match AND, if given,
   * subject match), OR'd together, so a teacher with several distinct
   * assignments sees the union of what each one covers -- never more.
   *
   * fromDate/toDate filter on Assessment.createdAt: the entity has no
   * date column of its own (only `term`, a two-value enum, see
   * AssessmentTerm), so createdAt -- already indexed via
   * @CreateDateColumn -- is the only timestamp available to filter a
   * date range against, same reasoning AttendanceService.findByDateForScope
   * has for using Attendance.date, the equivalent column on that entity.
   */
  async findForScope(
    schoolId: string,
    entries: { gradeId: string; classId: string | null; subjectId: string | null }[],
    filters: { studentId?: string; fromDate?: string; toDate?: string } = {},
    pagination: PaginationParams = {},
  ): Promise<Assessment[] | PaginatedResult<Assessment>> {
    if (entries.length === 0) {
      if (wantsPaginatedResponse(pagination)) {
        const { page, limit } = normalizePagination(pagination);
        return { data: [], total: 0, page, limit };
      }
      return [];
    }

    const qb = this.assessmentRepo
      .createQueryBuilder('assessment')
      .leftJoinAndSelect('assessment.subject', 'subject')
      .leftJoinAndSelect('assessment.student', 'student')
      .where('assessment.schoolId = :schoolId', { schoolId })
      .andWhere(
        new Brackets((outer) => {
          entries.forEach((entry, idx) => {
            outer.orWhere(
              new Brackets((inner) => {
                if (entry.classId) {
                  inner.andWhere(`student.classId = :classId${idx}`, {
                    [`classId${idx}`]: entry.classId,
                  });
                } else {
                  inner.andWhere(`student.gradeId = :gradeId${idx}`, {
                    [`gradeId${idx}`]: entry.gradeId,
                  });
                }
                if (entry.subjectId) {
                  inner.andWhere(`assessment.subjectId = :subjectId${idx}`, {
                    [`subjectId${idx}`]: entry.subjectId,
                  });
                }
              }),
            );
          });
        }),
      );

    if (filters.studentId) {
      qb.andWhere('assessment.studentId = :studentId', { studentId: filters.studentId });
    }
    // Both bounds compare directly against the (already ISO-validated,
    // see QueryTeacherAssessmentsDto's @IsDateString()) filter value --
    // a bare YYYY-MM-DD is interpreted by Postgres as that day's
    // midnight, same as comparing any other timestamptz column against a
    // date literal elsewhere in this codebase, so a toDate of just a
    // date (no time) is the *start* of that day, not its end. Callers
    // that want an inclusive same-day upper bound should pass a full
    // ISO timestamp (e.g. end-of-day) rather than a bare date.
    if (filters.fromDate) {
      qb.andWhere('assessment.createdAt >= :fromDate', { fromDate: filters.fromDate });
    }
    if (filters.toDate) {
      qb.andWhere('assessment.createdAt <= :toDate', { toDate: filters.toDate });
    }

    qb.orderBy('assessment.createdAt', 'DESC');

    // Same qb, same WHERE/Brackets built above -- no GROUP BY here (each
    // row is one Assessment), so skip/take + getManyAndCount() on this
    // exact query builder gives a correct total (matching rows before
    // the page slice) with no separate count query needed, unlike
    // SchoolsService.findAll()'s grouped raw query below.
    if (wantsPaginatedResponse(pagination)) {
      const { page, limit, skip } = normalizePagination(pagination);
      const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return qb.getMany();
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
    query: PaginationParams = {},
  ): Promise<Assessment[] | PaginatedResult<Assessment>> {
    await this.assertParentLinked(studentId, parentId);
    return this.findByStudent(studentId, schoolId, query);
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
