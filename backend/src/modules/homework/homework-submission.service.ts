import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HomeworkSubmission, HomeworkSubmissionStatus } from './entities/homework-submission.entity';
import { Student } from '../students/entities/student.entity';
import { HomeworkService } from './homework.service';
import { GradeHomeworkSubmissionDto } from './dto/grade-homework-submission.dto';

const SUBMISSION_RELATIONS = ['student', 'homework'];

// Sprint A.3.2: the fields a caller supplies to create/correct one
// student's submission for one homework -- a plain interface, not a
// class-validator DTO, same shape HomeworkService's own
// ResolvedHomeworkFields uses, since no controller/request pipeline is
// wired up for this sprint (see the entity's and HomeworkModule's header
// comments -- routes are a later sprint).
export interface RecordHomeworkSubmissionInput {
  homeworkId: string;
  studentId: string;
  status: HomeworkSubmissionStatus;
  // Explicit override only. Left undefined, submittedAt is derived from
  // `status` -- see resolveSubmittedAt() below -- so most callers never
  // need to pass this at all. Passing `null` explicitly clears it even
  // for a `submitted`/`late` status, for a future correction path (e.g.
  // "actually this was never submitted") that isn't otherwise reachable
  // by picking a status alone.
  submittedAt?: Date | null;
}

// Sprint A.3.2: per-homework status breakdown -- same "one list read,
// several counts derived from it" shape
// TeacherService.getMyAttendanceStatus() already returns for its own
// present/absent/late/excused summary.
export interface HomeworkSubmissionSummary {
  homeworkId: string;
  totalSubmissions: number;
  submittedCount: number;
  pendingCount: number;
  missingCount: number;
  lateCount: number;
}

/**
 * Sprint A.3.2 — Homework Submission Business Logic.
 *
 * Same architecture AttendanceService / AssessmentsService already use:
 * a single upsert-style record method keyed on the entity's unique
 * pairing (here, (homeworkId, studentId) -- see
 * uq_homework_submission_homework_student in the HomeworkSubmissions
 * migration), plus scoped reads that 404 a wrong-tenant id the same way
 * a nonexistent one 404s.
 *
 * Tenant/existence checks for the homework side are delegated to
 * HomeworkService.findOneForSchool() rather than re-querying the
 * Homework repo directly -- HomeworkService already owns every piece of
 * "does this homework exist, does it belong to this school" logic (see
 * its own findOneOrThrow()), so this service only adds the submission
 * row on top, never a second copy of that check. HomeworkModule wires
 * HomeworkService in as a normal same-module provider for this reason
 * (see homework.module.ts).
 *
 * No controller/route is added in this sprint -- every method here is
 * only reachable from other services/tests until a future sprint wires
 * up teacher/student-facing endpoints. Grading and file attachments are
 * deliberately out of scope, same as the entity itself (see
 * HomeworkSubmission's header comment) -- recordSubmission() only ever
 * writes status/submittedAt, never a score or an attachment reference.
 *
 * Sprint H3.0 update: grading is no longer out of scope -- see
 * gradeSubmission() below. File attachments remain unimplemented.
 * gradeSubmission() is intentionally independent of recordSubmission():
 * it never writes status/submittedAt, and recordSubmission() never
 * writes the grading columns, so the two write paths can't step on each
 * other.
 */
@Injectable()
export class HomeworkSubmissionService {
  constructor(
    @InjectRepository(HomeworkSubmission)
    private readonly submissionRepo: Repository<HomeworkSubmission>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly homeworkService: HomeworkService,
  ) {}

  /**
   * Creates or corrects one student's submission for one homework.
   *
   * Tenant enforcement mirrors AttendanceService.record(): the homework
   * is resolved through HomeworkService.findOneForSchool() (NotFound if
   * it doesn't exist at all, Forbidden if it exists but belongs to
   * another school -- HomeworkService's own findOneOrThrow() already
   * makes that split, not re-implemented here); the student is fetched
   * by id alone, then its schoolId compared to the caller's, same
   * NotFound/Forbidden split AttendanceService.record() applies to its
   * own student check.
   *
   * Upserts on (homeworkId, studentId) -- so correcting a submission
   * (e.g. a teacher re-marking `late` as `submitted`) is a second call,
   * not a 409/duplicate row, same "resubmitting corrects rather than
   * duplicates" shape as AttendanceService.record() /
   * AssessmentsService.record().
   */
  async recordSubmission(
    input: RecordHomeworkSubmissionInput,
    schoolId: string,
  ): Promise<HomeworkSubmission> {
    const homework = await this.homeworkService.findOneForSchool(input.homeworkId, schoolId);

    const student = await this.studentRepo.findOne({ where: { id: input.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
    }

    const submittedAt = this.resolveSubmittedAt(input.status, input.submittedAt);
    const existing = await this.findExisting(homework.id, student.id);

    if (existing) {
      existing.status = input.status;
      existing.submittedAt = submittedAt;
      return this.submissionRepo.save(existing);
    }

    const submission = this.submissionRepo.create({
      schoolId,
      homeworkId: homework.id,
      studentId: student.id,
      status: input.status,
      submittedAt,
    });
    return this.submissionRepo.save(submission);
  }

  /**
   * Sprint H3.0 — grades (or re-grades) one existing submission.
   *
   * Deliberately separate from recordSubmission() above, never
   * reimplements or calls into it: recordSubmission() owns the
   * submit-side upsert (status/submittedAt only, keyed on
   * (homeworkId, studentId)); this method owns only the grading fields
   * (score/feedback/gradedAt/gradedByUserId), keyed on the submission's
   * own id, and never writes status or submittedAt -- both are read
   * back unchanged on the same row this saves.
   *
   * Tenant enforcement mirrors findOne() above: the submission is
   * looked up scoped to schoolId (a wrong-tenant or nonexistent
   * submissionId both 404 identically, same "looks identical to
   * nonexistent" reasoning findOne()'s own comment gives). A submission
   * may be graded regardless of its current status -- this sprint does
   * not require `submitted`/`late` first, since a teacher correcting a
   * `missing` row straight to a score is a reasonable real-world flow
   * and nothing about the schema (every grading column is nullable
   * independent of status) forces otherwise.
   *
   * `score`'s upper bound is resolved here, not in the DTO: the
   * submission's homework is resolved through
   * HomeworkService.findOneForSchool() (already tenant-checked, so this
   * never re-derives a second tenant check for the homework side), and
   * if that Homework row happens to carry a `maxScore` property (it
   * does not today -- see the Homework entity and the DTO's own
   * comment) the score is additionally bounded by it; otherwise only
   * the DTO's own >= 0 floor applies. This runtime (not
   * compile-time-typed) check is what lets that upper bound activate
   * automatically the moment a future migration adds
   * Homework.maxScore, with no change needed here or in the DTO.
   *
   * `feedback` follows an explicit-omit-vs-explicit-clear rule: left
   * out of the request body entirely, any previously-stored feedback is
   * left untouched; an explicit empty string clears it. This is the
   * same "omitting a field leaves it unchanged, explicit value (however
   * empty) always wins" convention
   * RecordHomeworkSubmissionInput.submittedAt's own comment already
   * documents for this module.
   */
  async gradeSubmission(
    submissionId: string,
    dto: GradeHomeworkSubmissionDto,
    schoolId: string,
    teacherUserId: string,
  ): Promise<HomeworkSubmission> {
    const submission = await this.findOne(submissionId, schoolId);

    const homework = await this.homeworkService.findOneForSchool(submission.homeworkId, schoolId);
    const maxScore = (homework as unknown as { maxScore?: unknown }).maxScore;
    if (typeof maxScore === 'number' && dto.score > maxScore) {
      throw new BadRequestException('نمره نمی‌تواند بیشتر از حداکثر نمره تکلیف باشد');
    }

    submission.score = dto.score;
    if (dto.feedback !== undefined) {
      submission.feedback = dto.feedback;
    }
    submission.gradedAt = new Date();
    submission.gradedByUserId = teacherUserId;

    return this.submissionRepo.save(submission);
  }

  /**
   * One submission by id, scoped to the caller's school -- 404s a
   * wrong-tenant id exactly the same "looks identical to nonexistent"
   * way HomeworkService.findOneOrThrow() already does.
   */
  async findOne(id: string, schoolId: string): Promise<HomeworkSubmission> {
    const submission = await this.submissionRepo.findOne({
      where: { id, schoolId },
      relations: SUBMISSION_RELATIONS,
    });
    if (!submission) {
      throw new NotFoundException('ثبت تکلیف یافت نشد');
    }
    return submission;
  }

  /**
   * The single submission for one (homework, student) pair, if one has
   * been recorded yet -- the direct lookup along the table's unique
   * constraint, e.g. for "has this student already submitted this
   * homework". Returns null rather than throwing when no row exists yet
   * (a missing row is a normal, expected state here -- see
   * getSummary()'s own caveat about rows vs. roster), unlike findOne()
   * above which is keyed by the submission's own id and has no
   * "not created yet" case to represent.
   */
  async findForHomeworkAndStudent(
    homeworkId: string,
    studentId: string,
    schoolId: string,
  ): Promise<HomeworkSubmission | null> {
    await this.homeworkService.findOneForSchool(homeworkId, schoolId);
    return this.findExisting(homeworkId, studentId);
  }

  /**
   * ADR-001 Task 4E (architecture review follow-up): every submission
   * recorded for one student, across every homework, in a single query --
   * scoped directly by (studentId, schoolId) rather than by resolving each
   * homework individually. Unlike findForHomeworkAndStudent() above, this
   * does NOT call HomeworkService.findOneForSchool() per row: it doesn't
   * need to, since HomeworkSubmission already carries its own schoolId
   * column (see the entity's header comment on why every tenant-scoped
   * table here does), and the caller (StudentService.getMyHomework) has
   * already resolved "this studentId belongs to this authenticated user"
   * before calling.
   *
   * Exists specifically so a caller building a per-student homework list
   * (GET /student/homework) can fetch every submission once and map it
   * in memory by homeworkId, instead of calling
   * findForHomeworkAndStudent() once per homework row -- which would
   * re-run findOneForSchool() N times for homework the caller has already
   * fetched. Same "one list read, look things up in memory" shape
   * getSummary() above already uses over four separate COUNT queries.
   */
  async findAllForStudent(studentId: string, schoolId: string): Promise<HomeworkSubmission[]> {
    return this.submissionRepo.find({ where: { studentId, schoolId } });
  }

  /**
   * Every submission recorded for one homework, most recently updated
   * first. The homework itself is resolved through
   * HomeworkService.findOneForSchool() first, so a cross-tenant
   * homeworkId 404s before this ever queries the submissions table --
   * same "reuse the existing tenant check, don't re-derive one" shape
   * recordSubmission() above uses.
   */
  async findForHomework(homeworkId: string, schoolId: string): Promise<HomeworkSubmission[]> {
    await this.homeworkService.findOneForSchool(homeworkId, schoolId);
    return this.submissionRepo.find({
      where: { homeworkId, schoolId },
      relations: SUBMISSION_RELATIONS,
      order: { updatedAt: 'DESC' },
    });
  }


  /**
   * Per-status counts for one homework, derived from a single list read
   * (findForHomework() above) rather than four separate COUNT queries --
   * same "one read, several counts derived from it" shape
   * TeacherService.getMyAttendanceStatus() already uses for its own
   * present/absent/late/excused breakdown.
   *
   * `totalSubmissions` counts submission *rows*, not a class roster --
   * this service has no notion of "every student who should have
   * submitted" (that roster resolution is scoped to a teacher's own
   * assignments, see TeacherService.getMyStudents(), and is out of
   * scope for this generic school-level service). A student with no
   * submission row yet is simply absent from every count here, not
   * folded into `pendingCount` or `missingCount` -- a future
   * teacher-facing summary that also needs "students with no row yet"
   * would cross-reference this result against TeacherService's own
   * roster resolution, not something this method derives on its own.
   */
  async getSummary(homeworkId: string, schoolId: string): Promise<HomeworkSubmissionSummary> {
    const submissions = await this.findForHomework(homeworkId, schoolId);

    let submittedCount = 0;
    let pendingCount = 0;
    let missingCount = 0;
    let lateCount = 0;

    for (const submission of submissions) {
      switch (submission.status) {
        case HomeworkSubmissionStatus.SUBMITTED:
          submittedCount += 1;
          break;
        case HomeworkSubmissionStatus.PENDING:
          pendingCount += 1;
          break;
        case HomeworkSubmissionStatus.MISSING:
          missingCount += 1;
          break;
        case HomeworkSubmissionStatus.LATE:
          lateCount += 1;
          break;
      }
    }

    return {
      homeworkId,
      totalSubmissions: submissions.length,
      submittedCount,
      pendingCount,
      missingCount,
      lateCount,
    };
  }

  /**
   * getSubmittedCount/getPendingCount/getMissingCount/getLateCount below
   * are thin, independently-callable wrappers around the same
   * countByStatus() helper -- each re-verifies the homework's tenant via
   * HomeworkService.findOneForSchool() on its own, same as
   * findForHomework() and getSummary() above, so any one of them is safe
   * to call without first calling getSummary(). A caller that already
   * has the full breakdown should read it off getSummary()'s result
   * instead of calling these individually, to avoid four round trips
   * where one already sufficed.
   */
  async getSubmittedCount(homeworkId: string, schoolId: string): Promise<number> {
    return this.countByStatus(homeworkId, schoolId, HomeworkSubmissionStatus.SUBMITTED);
  }

  async getPendingCount(homeworkId: string, schoolId: string): Promise<number> {
    return this.countByStatus(homeworkId, schoolId, HomeworkSubmissionStatus.PENDING);
  }

  async getMissingCount(homeworkId: string, schoolId: string): Promise<number> {
    return this.countByStatus(homeworkId, schoolId, HomeworkSubmissionStatus.MISSING);
  }

  async getLateCount(homeworkId: string, schoolId: string): Promise<number> {
    return this.countByStatus(homeworkId, schoolId, HomeworkSubmissionStatus.LATE);
  }

  // ---------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------

  private async countByStatus(
    homeworkId: string,
    schoolId: string,
    status: HomeworkSubmissionStatus,
  ): Promise<number> {
    await this.homeworkService.findOneForSchool(homeworkId, schoolId);
    return this.submissionRepo.count({ where: { homeworkId, schoolId, status } });
  }

  private async findExisting(homeworkId: string, studentId: string): Promise<HomeworkSubmission | null> {
    return this.submissionRepo.findOne({ where: { homeworkId, studentId } });
  }

  /**
   * `submitted`/`late` mean the student actually submitted something, so
   * submittedAt defaults to "now" for those statuses when the caller
   * didn't supply one explicitly; `pending`/`missing` mean they haven't,
   * so it defaults to null. An explicit value (including an explicit
   * `null`) always wins over this default -- see
   * RecordHomeworkSubmissionInput.submittedAt's own comment for why a
   * caller might want to override it either way.
   */
  private resolveSubmittedAt(
    status: HomeworkSubmissionStatus,
    provided: Date | null | undefined,
  ): Date | null {
    if (provided !== undefined) {
      return provided;
    }
    return status === HomeworkSubmissionStatus.SUBMITTED || status === HomeworkSubmissionStatus.LATE
      ? new Date()
      : null;
  }
}
