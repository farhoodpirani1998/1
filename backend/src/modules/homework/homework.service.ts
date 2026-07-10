import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Homework } from './entities/homework.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { QueryHomeworkDto } from './dto/query-homework.dto';

const HOMEWORK_RELATIONS = ['grade', 'subject', 'teacher'];
const RECENT_HOMEWORK_LIMIT = 10;

// A fully-resolved set of the three fields the assignment check needs,
// whether they came from a fresh CreateHomeworkDto or from an existing
// row merged with a partial UpdateHomeworkDto -- same shape as
// TimetableService's ResolvedEntryFields.
interface ResolvedHomeworkFields {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
}

/**
 * Phase 5L: Homework & Assignments.
 *
 * Deliberately does not import TeacherModule or ParentModule: both need
 * HomeworkService (TeacherModule directly, for the /teacher/homework
 * CRUD surface; ParentModule directly, for
 * GET /parent/students/:id/homework), so importing either back here would
 * create a cycle. Declares its own narrow TypeORM repos for
 * AcademicYear/Grade/Subject/Student/ParentStudent/TeacherAssignment
 * instead -- same shape TimetableModule / StudentDocumentsModule /
 * StudentAssessmentsModule already use for the same reason.
 *
 * Every write is scoped to the calling teacher: a homework row's
 * teacherId is always the caller's own id (never taken from the request
 * body -- see CreateHomeworkDto), and update/remove only ever operate on
 * a row this same teacher created, the same "caller can't touch another
 * teacher's own writes" reasoning ParentService applies to a parent's
 * own linked children.
 */
@Injectable()
export class HomeworkService {
  constructor(
    @InjectRepository(Homework)
    private readonly homeworkRepo: Repository<Homework>,
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(TeacherAssignment)
    private readonly assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  // ---------------------------------------------------------------------
  // teacher-side management
  // ---------------------------------------------------------------------

  /**
   * Creates a new homework/assignment for one of the calling teacher's
   * own assigned (grade, subject) pairs. academicYearId/gradeId/subjectId
   * are each fetched by id alone, then their schoolId compared to the
   * caller's -- NotFound if a row doesn't exist at all, Forbidden if it
   * exists but belongs to another school, same shape as
   * TimetableService.create(). The teacher must additionally hold a
   * TeacherAssignment for the exact (gradeId, subjectId) pair -- reusing
   * the same assignment table TimetableService.assertAssigned() and
   * TeacherService.recordAssessment() already check against, rather than
   * re-deriving a separate notion of "who's allowed to assign what".
   */
  async create(dto: CreateHomeworkDto, teacherId: string, schoolId: string): Promise<Homework> {
    await this.assertRelationsInSchool(dto, schoolId);
    await this.assertAssigned(teacherId, dto.gradeId, dto.subjectId, schoolId);

    const homework = this.homeworkRepo.create({
      schoolId,
      academicYearId: dto.academicYearId,
      gradeId: dto.gradeId,
      subjectId: dto.subjectId,
      teacherId,
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate,
      attachmentUrl: dto.attachmentUrl ?? null,
    });
    const saved = await this.homeworkRepo.save(homework);
    return this.findOneOrThrow(saved.id, schoolId);
  }

  /**
   * Partial update, restricted to homework the calling teacher created
   * themselves. Fetched by (id, schoolId, teacherId) together -- another
   * teacher's homework, or another school's, 404s exactly the same way,
   * so a caller can never learn "that id exists, just not yours" from the
   * response. Merges whichever fields the caller provided onto the
   * existing row, then re-runs the same relation/assignment checks
   * create() runs against the merged result -- so a partial update can
   * never land in a state create() would have rejected outright.
   */
  async update(
    id: string,
    dto: UpdateHomeworkDto,
    teacherId: string,
    schoolId: string,
  ): Promise<Homework> {
    const homework = await this.homeworkRepo.findOne({ where: { id, schoolId, teacherId } });
    if (!homework) {
      throw new NotFoundException('این تکلیف یافت نشد');
    }

    const merged: ResolvedHomeworkFields = {
      academicYearId: dto.academicYearId ?? homework.academicYearId,
      gradeId: dto.gradeId ?? homework.gradeId,
      subjectId: dto.subjectId ?? homework.subjectId,
    };

    await this.assertRelationsInSchool(merged, schoolId);
    await this.assertAssigned(teacherId, merged.gradeId, merged.subjectId, schoolId);

    Object.assign(homework, merged, {
      title: dto.title ?? homework.title,
      description: dto.description ?? homework.description,
      dueDate: dto.dueDate ?? homework.dueDate,
      attachmentUrl: dto.attachmentUrl !== undefined ? dto.attachmentUrl : homework.attachmentUrl,
    });
    await this.homeworkRepo.save(homework);
    return this.findOneOrThrow(id, schoolId);
  }

  /**
   * Removal, restricted to homework the calling teacher created
   * themselves -- same (id, schoolId, teacherId) scoping as update().
   */
  async remove(id: string, teacherId: string, schoolId: string): Promise<void> {
    const homework = await this.homeworkRepo.findOne({ where: { id, schoolId, teacherId } });
    if (!homework) {
      throw new NotFoundException('این تکلیف یافت نشد');
    }
    await this.homeworkRepo.remove(homework);
  }

  /**
   * Every homework row the calling teacher has posted, within their own
   * school -- never a school-wide view. Re-scoped to schoolId even though
   * a teacher's own rows can only ever be created within their own school
   * by create() above, same defense-in-depth reasoning
   * TeacherService.getMyAssignments() already documents. Optionally
   * narrowed by gradeId/subjectId/academicYearId (see QueryHomeworkDto).
   */
  async findForTeacher(
    teacherId: string,
    schoolId: string,
    query: QueryHomeworkDto = {},
  ): Promise<Homework[]> {
    return this.homeworkRepo.find({
      where: {
        teacherId,
        schoolId,
        ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      relations: HOMEWORK_RELATIONS,
      order: { dueDate: 'ASC' },
    });
  }

  // ---------------------------------------------------------------------
  // school_admin-side read
  // ---------------------------------------------------------------------

  /**
   * school_admin-side listing, optionally narrowed by gradeId / subjectId
   * / teacherId / academicYearId. Every result is scoped to the caller's
   * own school -- same shape as TimetableService.findAllForSchool().
   */
  async findAllForSchool(schoolId: string, query: QueryHomeworkDto = {}): Promise<Homework[]> {
    return this.homeworkRepo.find({
      where: {
        schoolId,
        ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      relations: HOMEWORK_RELATIONS,
      order: { dueDate: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------
  // parent-side self-service read
  // ---------------------------------------------------------------------

  /**
   * Parent-side access: same "linked child only" rule as every other
   * /parent/students/:id/* route (ParentService.findMyStudent,
   * TimetableService.findForParent) -- 404, never 403, so a parent
   * probing an id can't tell "doesn't exist" from "exists but isn't
   * yours". Returns the *grade's* homework (a student doesn't have one
   * of their own -- they're assigned whatever's posted for their grade),
   * checked here directly rather than delegating to ParentService, for
   * the same reason TimetableService/StudentDocumentsService do their own
   * inline check: HomeworkModule is imported BY ParentModule, so
   * importing ParentModule back here would create a cycle.
   */
  async findForParent(studentId: string, parentId: string, schoolId: string): Promise<Homework[]> {
    await this.assertParentLinked(studentId, parentId);
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    return this.homeworkRepo.find({
      where: { gradeId: student.gradeId, schoolId },
      relations: HOMEWORK_RELATIONS,
      order: { dueDate: 'DESC' },
    });
  }

  /**
   * Used only by StudentProfileService to populate the profile's homework
   * section. The student's tenant/link check has already run in
   * StudentProfileService by the time this is called (same as
   * StudentDocumentsService.findRecentForStudent), so this is a plain,
   * capped read with no NotFound path of its own -- keyed by gradeId
   * (not studentId) since homework belongs to a grade, not an individual
   * student, same shape findForParent() above uses.
   */
  async findRecentForGrade(
    gradeId: string,
    schoolId: string,
    limit: number = RECENT_HOMEWORK_LIMIT,
  ): Promise<Homework[]> {
    return this.homeworkRepo.find({
      where: { gradeId, schoolId },
      relations: HOMEWORK_RELATIONS,
      order: { dueDate: 'DESC' },
      take: limit,
    });
  }

  // ---------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------

  private async findOneOrThrow(id: string, schoolId: string): Promise<Homework> {
    const homework = await this.homeworkRepo.findOne({
      where: { id, schoolId },
      relations: HOMEWORK_RELATIONS,
    });
    if (!homework) {
      throw new NotFoundException('این تکلیف یافت نشد');
    }
    return homework;
  }

  private async assertRelationsInSchool(
    fields: ResolvedHomeworkFields,
    schoolId: string,
  ): Promise<void> {
    const academicYear = await this.academicYearRepo.findOne({ where: { id: fields.academicYearId } });
    if (!academicYear) {
      throw new NotFoundException('سال تحصیلی یافت نشد');
    }
    if (academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
    }

    const grade = await this.gradeRepo.findOne({ where: { id: fields.gradeId } });
    if (!grade) {
      throw new NotFoundException('پایه یافت نشد');
    }
    if (grade.schoolId !== schoolId) {
      throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
    }

    const subject = await this.subjectRepo.findOne({ where: { id: fields.subjectId } });
    if (!subject) {
      throw new NotFoundException('درس یافت نشد');
    }
    if (subject.schoolId !== schoolId) {
      throw new ForbiddenException('این درس متعلق به مدرسه دیگری است');
    }
  }

  /**
   * Reuses the same TeacherAssignment table TimetableService.assertAssigned()
   * and TeacherService.recordAssessment() check against -- a teacher may
   * only post homework for a (grade, subject) pair they actually hold an
   * assignment for.
   */
  private async assertAssigned(
    teacherId: string,
    gradeId: string,
    subjectId: string,
    schoolId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { teacherId, gradeId, subjectId, schoolId },
    });
    if (!assignment) {
      throw new ForbiddenException('این معلم برای این پایه و درس تخصیص ندارد');
    }
  }

  private async assertParentLinked(studentId: string, parentId: string): Promise<void> {
    const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
    if (!link) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
  }
}
