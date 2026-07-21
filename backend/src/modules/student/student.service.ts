import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentUser } from '../students/entities/student-user.entity';
import { Student } from '../students/entities/student.entity';
import {
  StudentSelfProfileView,
  toStudentSelfProfileView,
} from './dto/student-self-profile-view.dto';
// ADR-001 Task 4C: GET /student/attendance is served by the same
// AttendanceService the parent portal already uses -- no new attendance
// business logic, just resolving "which student am I" and delegating to
// AttendanceService.findByStudent(), same shape as ParentController's
// GET /parent/students/:id/attendance.
import { AttendanceService } from '../attendance/attendance.service';
import { ParentAttendanceView, toParentAttendanceView } from '../attendance/dto/attendance-view.dto';
// ADR-001 Task 4D: GET /student/assessments and GET /student/report-card
// reuse AssessmentsService the same way GET /student/attendance reuses
// AttendanceService above -- no new assessment business logic, just
// resolving "which student am I" and delegating straight through to the
// existing findByStudent()/getReportCard() reads the parent portal already
// uses.
import { AssessmentsService } from '../student-assessments/assessments.service';
import {
  ParentAssessmentView,
  toParentAssessmentView,
} from '../student-assessments/dto/assessment-view.dto';
import { ReportCardView, buildReportCard } from '../student-assessments/dto/report-card-view.dto';
// ADR-001 Task 4E: GET /student/homework reuses HomeworkService (grade-
// derived list, same shape as HomeworkService.findForParent) and
// HomeworkSubmissionService (the authenticated student's own submission
// row per homework) -- no new homework/submission business logic, only
// resolving "which student am I" and combining two existing reads into
// one response.
import { HomeworkService } from '../homework/homework.service';
import { HomeworkSubmissionService } from '../homework/homework-submission.service';
import { HomeworkSubmissionStatus } from '../homework/entities/homework-submission.entity';
import { StudentHomeworkView, toStudentHomeworkView } from './dto/student-homework-view.dto';
// ADR-001 Task 4F: GET /student/announcements reuses AnnouncementsService
// the same way GET /student/attendance reuses AttendanceService above --
// no new announcement/visibility logic, just resolving "which student am
// I" and delegating straight through to the existing findForAudience()
// read the parent/teacher portals already use, scoped to the new STUDENTS
// audience value (see AnnouncementTargetType's own comment).
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementTargetType } from '../announcements/entities/announcement.entity';
import {
  RecipientAnnouncementView,
  toRecipientAnnouncementView,
} from '../announcements/dto/announcement-view.dto';
// ADR-001 Task 4G: GET /student/documents reuses StudentDocumentsService
// the same way GET /student/attendance reuses AttendanceService above --
// no new document business logic, just resolving "which student am I" and
// delegating to the existing findByStudent() read the parent portal
// already uses (ParentController's GET /parent/students/:id/documents).
import { StudentDocumentsService } from '../student-documents/student-documents.service';
import {
  ParentStudentDocumentView,
  toParentStudentDocumentView,
} from '../student-documents/dto/student-document-view.dto';
// ADR-001 Task 4H: GET /student/timetable reuses TimetableService the
// same way GET /student/attendance reuses AttendanceService above -- no
// new timetable business logic. A student has no schedule of their own
// (they attend whatever's scheduled for their grade, same as the parent
// portal's own GET /parent/students/:id/timetable), so this delegates to
// TimetableService.findAllForSchool() -- the same school_admin-facing
// read, narrowed by the resolved student's own gradeId -- rather than a
// new student-specific method.
import { TimetableService } from '../timetable/timetable.service';
import {
  RecipientTimetableEntryView,
  toRecipientTimetableEntryView,
} from '../timetable/dto/timetable-entry-view.dto';
// ADR-001 Task 4I-A: GET-nothing (service layer only) -- aggregates the
// views above into one dashboard read-model. See
// dto/student-dashboard-view.dto.ts for why no new calculation lives
// there either.
import { StudentDashboardView } from './dto/student-dashboard-view.dto';

// ADR-001 Task 4I-A: same "recent, bounded slice of a longer history"
// convention StudentProfileService already established for its own
// admin-facing aggregate (RECENT_ATTENDANCE_LIMIT / RECENT_DOCUMENTS_LIMIT
// there are also 10) -- kept local here since the dashboard is the only
// /student/* read that needs a bounded cut of these histories; every
// single-resource route (GET /student/attendance, etc.) still returns the
// full history unchanged.
const RECENT_ANNOUNCEMENTS_LIMIT = 10;
const RECENT_ATTENDANCE_LIMIT = 10;
const RECENT_ASSESSMENTS_LIMIT = 10;
const RECENT_DOCUMENTS_LIMIT = 10;

// ADR-001 Task 4A-1/4A-2: service-layer foundation for the /student/*
// portal, now consumed by GET /student/me -- see StudentController.
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentUser)
    private readonly studentUserRepo: Repository<StudentUser>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
    private readonly homeworkService: HomeworkService,
    private readonly homeworkSubmissionService: HomeworkSubmissionService,
    private readonly announcementsService: AnnouncementsService,
    private readonly studentDocumentsService: StudentDocumentsService,
    private readonly timetableService: TimetableService,
  ) {}

  /**
   * Resolves the Student record for the currently authenticated
   * student-role login -- always via StudentUser, never from a
   * client-supplied studentId. This is the one place a /student/* route
   * should ever go to find "which student am I" (mirrors
   * ParentService.findMyStudent()'s "resolve the link server-side"
   * shape for the parent portal).
   *
   * Tenant check: schoolId comes from the caller's own JWT
   * (CurrentUser('schoolId')) and is re-verified against
   * student.schoolId even though a StudentUser row can only ever point
   * at a student already in the same school the login was provisioned
   * for -- defense in depth, same reasoning ParentService.findMyStudents()
   * documents for its own re-check.
   *
   * A student-role user with no StudentUser row yet (provisioned but not
   * linked -- see AuthService.login's studentId-omitted case) gets a 404
   * here rather than a 500 or an empty object, same "missing link is a
   * normal, handled outcome" shape as everywhere else this link is read.
   */
  async getMyProfile(userId: string, schoolId: string): Promise<StudentSelfProfileView> {
    const student = await this.resolveMyStudent(userId, schoolId);
    return this.buildProfileView(student);
  }

  /**
   * ADR-001 Task 4C: the authenticated student's own attendance history.
   * Resolution is identical to getMyProfile's (StudentUser -> Student,
   * schoolId re-checked, 404 if either link is missing) -- reused here via
   * resolveMyStudent() rather than duplicated, so an unlinked student 404s
   * the same way on both routes. Once resolved, this delegates straight to
   * AttendanceService.findByStudent(), the same full-history read
   * findForParent() already uses for the parent portal; no redundant
   * tenant re-check is added on top since resolveMyStudent() already
   * confirmed the student belongs to this schoolId.
   *
   * Returns the existing parent-facing DTO shape (no recordedById, no
   * internal ids) -- see the doc comment on ParentAttendanceView.
   */
  async getMyAttendance(userId: string, schoolId: string): Promise<ParentAttendanceView[]> {
    const student = await this.resolveMyStudent(userId, schoolId);
    const records = await this.attendanceService.findByStudent(student.id, schoolId);
    return records.map(toParentAttendanceView);
  }

  /**
   * ADR-001 Task 4D: the authenticated student's own assessment history.
   * Resolution is identical to getMyAttendance's (resolveMyStudent(), 404
   * if unlinked or cross-school) -- reused, not duplicated, so an unlinked
   * student 404s the same way on every /student/* route. Delegates to
   * AssessmentsService.findByStudent(), the same full-history read
   * findForParent() uses for the parent portal, then maps through the
   * existing ParentAssessmentView shape (no recordedById, no schoolId) --
   * no new assessment-reshaping logic here or in the service.
   */
  async getMyAssessments(userId: string, schoolId: string): Promise<ParentAssessmentView[]> {
    const student = await this.resolveMyStudent(userId, schoolId);
    const records = await this.assessmentsService.findByStudent(student.id, schoolId);
    return records.map(toParentAssessmentView);
  }

  /**
   * ADR-001 Task 4D: the authenticated student's own report card. Same
   * resolveMyStudent() resolution as every other /student/* route, then
   * delegates straight through to AssessmentsService.getReportCard() --
   * ReportCardView is already caller-agnostic (built by the same
   * buildReportCard() shared with the staff and parent report-card
   * routes), so it's returned as-is with no student-specific reshaping.
   */
  async getMyReportCard(userId: string, schoolId: string): Promise<ReportCardView> {
    const student = await this.resolveMyStudent(userId, schoolId);
    return this.assessmentsService.getReportCard(student.id, schoolId);
  }

  /**
   * ADR-001 Task 4E: the authenticated student's own homework, each item
   * combined with that same student's own submission status. Resolution
   * is the same resolveMyStudent() every other /student/* route uses (404
   * if unlinked or cross-school); the resolved student.id is then used
   * for two existing reads, never a client-supplied studentId:
   *
   * - HomeworkService.findForStudent(student.id, schoolId) -- the
   *   grade-derived homework list, same shape findForParent() already
   *   returns for the parent portal (homework belongs to a grade, not an
   *   individual student).
   * - HomeworkSubmissionService.findAllForStudent(student.id, schoolId) --
   *   every submission this student has, fetched once rather than once
   *   per homework row (architecture-review follow-up: the original
   *   version called findForHomeworkAndStudent() per item, which is N+1 --
   *   one query for the homework list plus two per item, since that
   *   method also re-verifies the homework's tenant on every call).
   *   Submissions are then indexed by homeworkId in memory and looked up
   *   per item, so the whole response costs exactly two queries
   *   regardless of how many homework rows there are.
   *
   * No new homework/submission logic is added here -- this only combines
   * two existing service reads into one response via toStudentHomeworkView.
   */
  async getMyHomework(userId: string, schoolId: string): Promise<StudentHomeworkView[]> {
    const student = await this.resolveMyStudent(userId, schoolId);
    return this.buildHomeworkView(student.id, schoolId);
  }

  /**
   * Sprint H1.5: the authenticated student's own action to submit (or
   * resubmit/correct) one homework — the only /student/* write in this
   * service, every other method here is read-only. Resolution is the
   * identical resolveMyStudent() every read above uses (404 if unlinked
   * or cross-school), so an unlinked student can't submit any more than
   * they can read.
   *
   * The homework itself is fetched once via
   * HomeworkService.findOneForSchool() — the same tenant check (404
   * nonexistent, 403 cross-school) every other homework-adjacent read in
   * this class already gets, and the one place `dueDate` needs to come
   * from. That check only ever confirms *tenant* (same school) — it says
   * nothing about whether this homework was posted for this student's own
   * grade. HomeworkSubmissionService.recordSubmission() doesn't check that
   * either (by design — see its own doc comment: it only ever enforces
   * schoolId, the same scope every other homework write in the codebase
   * checks). Left unchecked, any authenticated student could submit a
   * homework row belonging to a different grade in the same school, since
   * findOneForSchool()'s 403/404 split is keyed on schoolId alone.
   *
   * So this method adds the one check that's actually missing, right
   * here rather than in HomeworkSubmissionService (which stays a generic,
   * reusable "record this student's submission for this homework" writer
   * — narrowing its tenant check to "same grade too" would break any
   * future caller, e.g. a teacher correcting a submission, that has no
   * "my own grade" notion to enforce): using the already-loaded `homework`
   * and `student` from resolveMyStudent()/findOneForSchool() above (no
   * extra query), homework.gradeId must equal student.gradeId, or this
   * 403s before anything is written. (Homework has no separate
   * class-level assignment field today — see Homework entity — so grade
   * is the full ownership check for now; a class dimension would be added
   * here too if one's ever introduced.)
   *
   * Status is computed here, once, from a plain string-date compare
   * against `dueDate` ('YYYY-MM-DD', the same format the frontend's own
   * isOverdue() already compares against): 'late' once today's date is
   * past dueDate, 'submitted' otherwise. This is the other piece of new
   * business logic this sprint adds — everything else (the
   * upsert-on-resubmit, the tenant checks, submittedAt derivation) is
   * entirely HomeworkSubmissionService.recordSubmission()'s existing
   * logic, reused as-is and never reimplemented here.
   *
   * Returns the same StudentHomeworkView shape GET /student/homework
   * already returns per row (built via the same toStudentHomeworkView()
   * mapper, fed the same already-fetched `homework` plus the fresh
   * `submission`), so the frontend can drop this response straight into
   * its existing list/cache without a new type.
   */
  async submitMyHomework(
    userId: string,
    schoolId: string,
    homeworkId: string,
  ): Promise<StudentHomeworkView> {
    const student = await this.resolveMyStudent(userId, schoolId);
    const homework = await this.homeworkService.findOneForSchool(homeworkId, schoolId);

    if (homework.gradeId !== student.gradeId) {
      throw new ForbiddenException('این تکلیف متعلق به پایه شما نیست');
    }

    const today = new Date().toISOString().slice(0, 10);
    const status =
      today > homework.dueDate ? HomeworkSubmissionStatus.LATE : HomeworkSubmissionStatus.SUBMITTED;

    const submission = await this.homeworkSubmissionService.recordSubmission(
      { homeworkId: homework.id, studentId: student.id, status },
      schoolId,
    );

    return toStudentHomeworkView(homework, submission);
  }

  /**
   * ADR-001 Task 4F: the authenticated student's own visible announcements.
   * Resolution is the same resolveMyStudent() every other /student/* route
   * uses (404 if unlinked or cross-school) -- reused here purely to
   * confirm the caller is a valid, linked student before reading anything,
   * same as every method above. The schoolId used for the actual
   * announcement read is the caller's own schoolId (already re-verified
   * by resolveMyStudent()), never the student row's, matching the
   * "schoolId comes from the token" shape ParentController/
   * TeacherController use for their own GET /parent|teacher/announcements
   * routes.
   *
   * Delegates straight through to AnnouncementsService.findForAudience()
   * with AnnouncementTargetType.STUDENTS -- the exact same method and
   * "ALL or the caller's own audience" filtering PARENTS/TEACHERS already
   * get, no new visibility logic here or in the service. Mapped through
   * the existing toRecipientAnnouncementView (no createdById, no
   * schoolId) -- already student-safe, so no new DTO is introduced.
   */
  async getMyAnnouncements(userId: string, schoolId: string): Promise<RecipientAnnouncementView[]> {
    await this.resolveMyStudent(userId, schoolId);
    const announcements = await this.announcementsService.findForAudience(
      schoolId,
      AnnouncementTargetType.STUDENTS,
    );
    return announcements.map(toRecipientAnnouncementView);
  }

  /**
   * ADR-001 Task 4G: the authenticated student's own uploaded documents.
   * Resolution is the same resolveMyStudent() every other /student/*
   * route uses (404 if unlinked or cross-school); the resolved
   * student.id is then passed to StudentDocumentsService.findByStudent(),
   * the same full-history read used for GET /student/attendance and
   * GET /student/assessments -- that method re-checks (studentId,
   * schoolId) itself (assertStudentInSchool()), same redundant-but-cheap
   * defense-in-depth shape as those other reads, no new document logic
   * here or in the service. Mapped through the existing
   * toParentStudentDocumentView (no schoolId, no studentId, no
   * uploadedById) -- already student-safe, so no new DTO is introduced.
   */
  async getMyDocuments(userId: string, schoolId: string): Promise<ParentStudentDocumentView[]> {
    const student = await this.resolveMyStudent(userId, schoolId);
    const documents = await this.studentDocumentsService.findByStudent(student.id, schoolId);
    return documents.map(toParentStudentDocumentView);
  }

  /**
   * ADR-001 Task 4H: the timetable for the authenticated student's own
   * grade. Resolution is the same resolveMyStudent() every other
   * /student/* route uses (404 if unlinked or cross-school); the
   * resolved student's own gradeId is then passed to
   * TimetableService.findAllForSchool() as a filter -- the same
   * (schoolId, gradeId)-scoped read the school_admin GET /timetable route
   * already supports via QueryTimetableDto, no new timetable method or
   * visibility logic added. Mapped through the existing
   * toRecipientTimetableEntryView (identical shape to the admin view --
   * TimetableEntry has no internal-only column to strip, see that DTO's
   * own comment) -- already student-safe, so no new DTO is introduced.
   */
  async getMyTimetable(userId: string, schoolId: string): Promise<RecipientTimetableEntryView[]> {
    const student = await this.resolveMyStudent(userId, schoolId);
    return this.buildTimetableView(student.gradeId, schoolId);
  }

  /**
   * ADR-001 Task 4I-A: one combined read for the student portal's
   * dashboard/home screen. Resolution happens exactly once here --
   * resolveMyStudent() is called a single time, and every section below
   * is built from that same already-resolved `student` (its id, gradeId,
   * schoolId), never re-resolved. This is the reason profile/homework/
   * timetable are each factored into their own buildXView() helper below:
   * getMyProfile()/getMyHomework()/getMyTimetable() call resolveMyStudent()
   * themselves and then reuse the same helper, so this method can reuse
   * the identical assembly logic without triggering a second
   * StudentUser/Student lookup the way calling those public methods
   * outright would.
   *
   * No new business logic is introduced anywhere in this method -- every
   * section is exactly one existing service call (the same ones
   * getMyAttendance/getMyAssessments/getMyReportCard/getMyDocuments/
   * getMyAnnouncements already use, or their already-existing "recent,
   * bounded" counterparts) mapped through the exact same view function
   * those routes already use:
   *
   * - profile: buildProfileView(), shared with getMyProfile().
   * - timetable: buildTimetableView(), shared with getMyTimetable() --
   *   full grade timetable, not a history, so no "recent" cut applies.
   * - recentAnnouncements: AnnouncementsService.findForAudience() (the
   *   exact call getMyAnnouncements() makes), sliced to
   *   RECENT_ANNOUNCEMENTS_LIMIT -- findForAudience() already orders
   *   newest-first, so slicing its result is the only "recency" logic
   *   needed, no new query or sorting.
   * - homework: buildHomeworkView(), shared with getMyHomework() -- a
   *   grade's assigned homework, not a history, so no "recent" cut
   *   applies either.
   * - recentAttendance: AttendanceService.findRecentForStudent(), the
   *   same bounded read StudentProfileService's own admin-facing
   *   aggregate already uses.
   * - recentAssessments / reportCard: queried once via
   *   AssessmentsService.findAllForStudent() (architecture-review
   *   follow-up: this used to call findRecentForStudent() *and*
   *   getReportCard() separately, hitting the assessments table twice)
   *   -- same "one fetch, two derived views" shape StudentProfileService
   *   already uses for its own admin/parent-facing aggregate: the same
   *   array is sliced (newest first) for recentAssessments and passed to
   *   the shared buildReportCard() for reportCard, so the report-card
   *   average is still computed over full history while the display
   *   list is still bounded, from one query instead of two.
   * - recentDocuments: StudentDocumentsService.findRecentForStudent(),
   *   the same bounded read StudentProfileService's own aggregate uses.
   *
   * Every read below is independent of every other, so they run
   * concurrently via Promise.all() rather than sequentially -- one round
   * of parallel queries instead of seven serial ones.
   */
  async getMyDashboard(userId: string, schoolId: string): Promise<StudentDashboardView> {
    const student = await this.resolveMyStudent(userId, schoolId);

    const [timetable, announcements, homework, attendanceRecords, assessmentRecords, documentRecords] =
      await Promise.all([
        this.buildTimetableView(student.gradeId, schoolId),
        this.announcementsService.findForAudience(schoolId, AnnouncementTargetType.STUDENTS),
        this.buildHomeworkView(student.id, schoolId),
        this.attendanceService.findRecentForStudent(student.id, RECENT_ATTENDANCE_LIMIT),
        this.assessmentsService.findAllForStudent(student.id),
        this.studentDocumentsService.findRecentForStudent(student.id, RECENT_DOCUMENTS_LIMIT),
      ]);

    // Same "sort newest first, then take the top N" the removed
    // findRecentForStudent() call did on the database side -- done here
    // in memory instead, over the one array already fetched above, so
    // the response is unchanged while the query count drops from two to
    // one. reportCard is built from the same, un-sliced array so its
    // average still reflects every assessment, exactly like
    // AssessmentsService.getReportCard()/StudentProfileService already do.
    const recentAssessments = [...assessmentRecords]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_ASSESSMENTS_LIMIT);

    return {
      profile: this.buildProfileView(student),
      timetable,
      recentAnnouncements: announcements
        .slice(0, RECENT_ANNOUNCEMENTS_LIMIT)
        .map(toRecipientAnnouncementView),
      homework,
      recentAttendance: attendanceRecords.map(toParentAttendanceView),
      recentAssessments: recentAssessments.map(toParentAssessmentView),
      reportCard: buildReportCard(student.id, assessmentRecords),
      recentDocuments: documentRecords.map(toParentStudentDocumentView),
    };
  }

  // -----------------------------------------------------------------
  // Shared builders -- each takes an already-resolved student's id/
  // gradeId (never userId/schoolId directly), so both the single-purpose
  // getMyX() method above and getMyDashboard() above assemble identical
  // output from one resolveMyStudent() call, never two.
  // -----------------------------------------------------------------

  private buildProfileView(student: Student): StudentSelfProfileView {
    return toStudentSelfProfileView(student);
  }

  private async buildHomeworkView(studentId: string, schoolId: string): Promise<StudentHomeworkView[]> {
    const [homeworkList, submissions] = await Promise.all([
      this.homeworkService.findForStudent(studentId, schoolId),
      this.homeworkSubmissionService.findAllForStudent(studentId, schoolId),
    ]);

    const submissionByHomeworkId = new Map(submissions.map((s) => [s.homeworkId, s]));

    return homeworkList.map((homework) =>
      toStudentHomeworkView(homework, submissionByHomeworkId.get(homework.id) ?? null),
    );
  }

  private async buildTimetableView(
    gradeId: string,
    schoolId: string,
  ): Promise<RecipientTimetableEntryView[]> {
    const entries = await this.timetableService.findAllForSchool(schoolId, { gradeId });
    return entries.map(toRecipientTimetableEntryView);
  }

  private async resolveMyStudent(userId: string, schoolId: string): Promise<Student> {
    const link = await this.studentUserRepo.findOne({ where: { userId } });
    if (!link) {
      throw new NotFoundException('حساب کاربری شما به هیچ دانش‌آموزی متصل نیست');
    }

    const student = await this.studentRepo.findOne({ where: { id: link.studentId } });
    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    return student;
  }
}
