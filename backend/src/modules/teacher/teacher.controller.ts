import { Controller, Post, Get, Put, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { QueryTeacherStudentsDto } from './dto/query-teacher-students.dto';
import { QueryTeacherAttendanceDto } from './dto/query-teacher-attendance.dto';
import { QueryTeacherAttendanceStatusDto } from './dto/query-teacher-attendance-status.dto';
import { QueryTeacherAssessmentsDto } from './dto/query-teacher-assessments.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { toAttendanceView } from '../attendance/dto/attendance-view.dto';
import { CreateAssessmentDto } from '../student-assessments/dto/create-assessment.dto';
import { toAssessmentView } from '../student-assessments/dto/assessment-view.dto';
import { toTeacherProfileView, toTeacherAssignmentView, toTeacherListItemView } from './dto/teacher-view.dto';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementTargetType } from '../announcements/entities/announcement.entity';
import { toTeacherAnnouncementView } from '../announcements/dto/announcement-view.dto';
import { TimetableService } from '../timetable/timetable.service';
import { toTimetableEntryView } from '../timetable/dto/timetable-entry-view.dto';
import { HomeworkService } from '../homework/homework.service';
import { CreateHomeworkDto } from '../homework/dto/create-homework.dto';
import { UpdateHomeworkDto } from '../homework/dto/update-homework.dto';
import { QueryHomeworkDto } from '../homework/dto/query-homework.dto';
import { toHomeworkView } from '../homework/dto/homework-view.dto';
import { QueryTeacherHomeworkSubmissionsDto } from './dto/query-teacher-homework-submissions.dto';
import { toTeacherHomeworkSubmissionView } from './dto/teacher-homework-submission-view.dto';
import { GradeHomeworkSubmissionDto } from '../homework/dto/grade-homework-submission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Teacher Portal')
@ApiBearerAuth('access-token')
@Controller('teacher')
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    // Phase 5H: GET /teacher/announcements is served directly by
    // AnnouncementsService, same "dedicated portal controller reads a
    // shared service directly" shape as ParentController injecting
    // AttendanceService / AssessmentsService for its own read routes,
    // rather than adding an announcements pass-through method to
    // TeacherService.
    private readonly announcementsService: AnnouncementsService,
    // Phase 5K: GET /teacher/timetable is served directly by
    // TimetableService, same "dedicated portal controller reads a shared
    // service directly" shape as the announcements route above.
    private readonly timetableService: TimetableService,
    private readonly homeworkService: HomeworkService,
  ) {}

  // ---------------------------------------------------------------------
  // school_admin-side assignment management. Kept in this same controller
  // (rather than a separate module) since it's the only place
  // teacher_assignments rows are created/removed -- same reasoning
  // ParentController keeps POST /parent/link alongside the parent
  // self-service routes.
  // ---------------------------------------------------------------------

  @Post('assignments')
  @Roles('school_admin')
  async assign(@Body() dto: CreateTeacherAssignmentDto, @CurrentUser('schoolId') schoolId: string) {
    const assignment = await this.teacherService.assign(dto, schoolId);
    return toTeacherAssignmentView(assignment);
  }

  @Get('assignments')
  @Roles('school_admin')
  async listAssignments(
    @Query('teacherId') teacherId: string | undefined,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const assignments = await this.teacherService.listAssignments(schoolId, teacherId);
    return assignments.map(toTeacherAssignmentView);
  }

  @Delete('assignments/:id')
  @Roles('school_admin')
  @HttpCode(204)
  async unassign(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.teacherService.unassign(id, schoolId);
  }

  // Sprint 2B: the teacher picker on TeacherAssignmentsPage needs a
  // school-scoped roster of teacher-role users -- GET /users can't serve
  // this (@Roles('super_admin') only, and not school-scoped), so this is
  // a dedicated route here, same "admin management lives next to the
  // assignment routes it supports" reasoning as assign()/listAssignments()
  // above.
  @Get('list')
  @Roles('school_admin')
  async listTeachers(@CurrentUser('schoolId') schoolId: string) {
    const teachers = await this.teacherService.listTeachers(schoolId);
    return teachers.map(toTeacherListItemView);
  }

  // ---------------------------------------------------------------------
  // teacher self-service: every route below is scoped to the caller's own
  // assignments (TeacherService re-derives this from teacher_assignments
  // on every call), never a school-wide view -- same isolation shape as
  // /parent/* being scoped to a parent's own linked children.
  // ---------------------------------------------------------------------

  @Get('profile')
  @Roles('teacher')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const { user: teacher, assignments } = await this.teacherService.getProfile(user.id, user.schoolId);
    return toTeacherProfileView(teacher, assignments);
  }

  @Get('classes')
  @Roles('teacher')
  getMyClasses(@CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getMyClasses(user.id, user.schoolId);
  }

  @Get('subjects')
  @Roles('teacher')
  getMySubjects(@CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getMySubjects(user.id, user.schoolId);
  }

  @Get('students')
  @Roles('teacher')
  getMyStudents(@Query() query: QueryTeacherStudentsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getMyStudents(user.id, user.schoolId, query);
  }

  // The same "پروفایل دانش‌آموز" card (photo/info/parent phone/
  // attendance/average/progress chart/homework) the school_admin portal
  // sees at GET /students/:id/profile, scoped to one of the teacher's
  // own assigned students — see TeacherService.getStudentProfile for the
  // assignment gate.
  @Get('students/:id/profile')
  @Roles('teacher')
  getMyStudentProfile(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getStudentProfile(user.id, user.schoolId, id);
  }

  // Recording/correcting attendance for one of the teacher's own assigned
  // classes. TeacherService.recordAttendance() checks the assignment
  // before delegating to AttendanceService.record(), which owns every
  // other piece of business logic (upsert-on-resubmit, academicYearId
  // derivation) unchanged.
  @ApiOperation({ summary: "Record attendance for one of the teacher's own assigned classes" })
  @Post('attendance')
  @Roles('teacher')
  async recordAttendance(@Body() dto: CreateAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    const attendance = await this.teacherService.recordAttendance(dto, user.id, user.schoolId);
    return toAttendanceView(attendance);
  }

  // Sprint A.1: read-only attendance views scoped to the teacher's own
  // assigned classes. TeacherService resolves the same (whole-grade,
  // class) scope getMyStudents() uses and delegates the actual record
  // lookup to AttendanceService.findByDateForScope() -- no attendance
  // business logic is reimplemented here.

  @Get('attendance/today')
  @Roles('teacher')
  async getMyAttendanceToday(
    @Query() query: QueryTeacherAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const records = await this.teacherService.getMyAttendanceToday(user.id, user.schoolId, query);
    return records.map(toAttendanceView);
  }

  @Get('attendance/date/:date')
  @Roles('teacher')
  async getMyAttendanceByDate(
    @Param('date') date: string,
    @Query() query: QueryTeacherAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const records = await this.teacherService.getMyAttendanceByDate(user.id, user.schoolId, date, query);
    return records.map(toAttendanceView);
  }

  // Per-class attendance status (roster size + present/absent/late/
  // excused counts) for one calendar day, defaulting to today -- the
  // "which of my classes still need attendance taken" summary.
  @Get('attendance/status')
  @Roles('teacher')
  async getMyAttendanceStatus(
    @Query() query: QueryTeacherAttendanceStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teacherService.getMyAttendanceStatus(user.id, user.schoolId, query);
  }

  // Recording/correcting an assessment score for one of the teacher's own
  // assigned grade+subject combinations. TeacherService.recordAssessment()
  // checks the assignment before delegating to AssessmentsService.record(),
  // which owns every other piece of business logic unchanged.
  @Post('assessments')
  @Roles('teacher')
  async recordAssessment(@Body() dto: CreateAssessmentDto, @CurrentUser() user: AuthenticatedUser) {
    const assessment = await this.teacherService.recordAssessment(dto, user.id, user.schoolId);
    return toAssessmentView(assessment);
  }

  // Sprint A.2: read-only assessment views scoped to the teacher's own
  // assigned (grade, class, subject) combinations. TeacherService
  // resolves that scope (see resolveAssessmentScope()) and delegates the
  // actual record lookup to AssessmentsService.findForScope() -- no
  // assessment business logic is reimplemented here, same shape as the
  // Sprint A.1 attendance-read routes above.
  @Get('assessments')
  @Roles('teacher')
  async getMyAssessments(@Query() query: QueryTeacherAssessmentsDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.teacherService.getMyAssessments(user.id, user.schoolId, query);
    if (Array.isArray(result)) {
      return result.map(toAssessmentView);
    }
    return { ...result, data: result.data.map(toAssessmentView) };
  }

  // Phase 5H: School Announcements. Read-only, teacher-scoped: only
  // announcements targeted at 'all' or 'teachers', within the caller's
  // own school -- AnnouncementsService.findForAudience() enforces both,
  // the audience is hardcoded here (never taken from the request), same
  // "caller can't widen their own view" reasoning as every other
  // audience-scoped read in this codebase.
  //
  // Sprint A.4: extended (not replaced) with each announcement's isRead
  // /readAt for the calling teacher -- every field this route already
  // returned is unchanged, see toTeacherAnnouncementView()'s own
  // comment. findForAudienceWithReadStatus() applies the exact same
  // audience/school scoping findForAudience() always has; this is
  // strictly additive.
  @Get('announcements')
  @Roles('teacher')
  async getMyAnnouncements(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.announcementsService.findForAudienceWithReadStatus(
      user.schoolId,
      AnnouncementTargetType.TEACHERS,
      user.id,
      query,
    );
    const mapView = (entries: { announcement: any; isRead: boolean; readAt: Date | null }[]) =>
      entries.map(({ announcement, isRead, readAt }) =>
        toTeacherAnnouncementView(announcement, isRead, readAt),
      );

    if (Array.isArray(result)) {
      return mapView(result);
    }
    return { ...result, data: mapView(result.data) };
  }

  // Sprint A.4: marks one announcement as read for the calling teacher.
  // AnnouncementsService.markAsRead() re-checks the same audience/school
  // visibility getMyAnnouncements() above enforces (never taken from the
  // request) -- a teacher can only ever mark-as-read an announcement
  // they could already see through that route, same "caller can't act
  // outside their own visible scope" reasoning as every other
  // teacher-facing write in this controller. Idempotent: a repeat call
  // for an already-read announcement returns the original readAt
  // unchanged rather than erroring or bumping it (see markAsRead()'s own
  // comment).
  @Post('announcements/:id/read')
  @Roles('teacher')
  @HttpCode(200)
  async markAnnouncementRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const read = await this.announcementsService.markAsRead(
      id,
      user.id,
      user.schoolId,
      AnnouncementTargetType.TEACHERS,
    );
    return { id: read.announcementId, isRead: true, readAt: read.readAt };
  }

  // Phase 5K: Timetable Foundation. Read-only, teacher-scoped: every
  // scheduled period for the caller, within their own school --
  // TimetableService.findForTeacher() re-scopes to schoolId itself, same
  // defense-in-depth reasoning as getMyAssignments() above.
  @Get('timetable')
  @Roles('teacher')
  async getMyTimetable(@CurrentUser() user: AuthenticatedUser) {
    const entries = await this.timetableService.findForTeacher(user.id, user.schoolId);
    return entries.map(toTimetableEntryView);
  }

  // Phase 5L: Homework & Assignments. Posting/correcting/removing/reading
  // homework is restricted to one of the teacher's own assigned
  // (grade, subject) pairs -- HomeworkService.create()/update() check
  // this via the same TeacherAssignment table every other /teacher/*
  // write already checks against (see recordAttendance/recordAssessment
  // above). teacherId is always the caller's own id, never taken from the
  // request body (see CreateHomeworkDto).

  @ApiOperation({ summary: 'Create a homework assignment for one of the teacher\'s classes' })
  @Post('homework')
  @Roles('teacher')
  async createHomework(@Body() dto: CreateHomeworkDto, @CurrentUser() user: AuthenticatedUser) {
    const homework = await this.homeworkService.create(dto, user.id, user.schoolId);
    return toHomeworkView(homework);
  }

  @Get('homework')
  @Roles('teacher')
  async getMyHomework(@Query() query: QueryHomeworkDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.homeworkService.findForTeacher(user.id, user.schoolId, query);
    if (Array.isArray(result)) {
      return result.map(toHomeworkView);
    }
    return { ...result, data: result.data.map(toHomeworkView) };
  }

  @Put('homework/:id')
  @Roles('teacher')
  async updateHomework(
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const homework = await this.homeworkService.update(id, dto, user.id, user.schoolId);
    return toHomeworkView(homework);
  }

  @Delete('homework/:id')
  @Roles('teacher')
  @HttpCode(204)
  async deleteHomework(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.homeworkService.remove(id, user.id, user.schoolId);
  }

  // Sprint A.3.3: teacher-facing homework submission reads. Access is
  // gated by TeacherService.assertHomeworkAccessible() -- the homework
  // must exist in the caller's school AND the teacher must hold an
  // assignment covering its (gradeId, subjectId), not necessarily the
  // teacher who posted it (see that method's own comment). Grading and
  // file uploads are not implemented -- every route below is read-only.

  @Get('homework/:id/submissions')
  @Roles('teacher')
  async getMyHomeworkSubmissions(
    @Param('id') id: string,
    @Query() query: QueryTeacherHomeworkSubmissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const submissions = await this.teacherService.getMyHomeworkSubmissions(user.id, user.schoolId, id, query);
    return submissions.map(toTeacherHomeworkSubmissionView);
  }

  // Roster-aware per-status breakdown -- totalStudents is the teacher's
  // actual assigned roster for the homework's grade (via
  // TeacherService.getMyStudents()), not a count of submission rows, so
  // a student with no row yet still counts toward missingCount. See
  // TeacherService.buildRosterAwareSubmissionSummary() for why this
  // differs from HomeworkSubmissionService.getSummary().
  @Get('homework/:id/submissions/summary')
  @Roles('teacher')
  getMyHomeworkSubmissionSummary(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getMyHomeworkSubmissionSummary(user.id, user.schoolId, id);
  }

  // Sprint H3.0 — grades (or re-grades) one submission. Declared as its
  // own literal path segment ('submissions/:submissionId', not nested
  // under 'homework/:id/...') since grading acts on a submission by its
  // own id, not by (homeworkId, studentId) -- the caller doesn't need
  // to already know which homework a submission belongs to.
  // Authorization is the exact same assignment gate every other
  // homework-submission route above already uses -- see
  // TeacherService.gradeMyHomeworkSubmission().
  @ApiOperation({ summary: "Grade a student's homework submission" })
  @Patch('homework/submissions/:submissionId')
  @Roles('teacher')
  async gradeHomeworkSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeHomeworkSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const submission = await this.teacherService.gradeMyHomeworkSubmission(
      user.id,
      user.schoolId,
      submissionId,
      dto,
    );
    return toTeacherHomeworkSubmissionView(submission);
  }

  // Same roster-aware counts as the summary route above, plus the
  // percentage rates derived from them.
  @Get('homework/:id/submissions/statistics')
  @Roles('teacher')
  getMyHomeworkSubmissionStatistics(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherService.getMyHomeworkSubmissionStatistics(user.id, user.schoolId, id);
  }

  // ---------------------------------------------------------------------
  // school_admin-facing single-teacher read, for the teacher detail page
  // linked from Global Search results. Deliberately declared last: every
  // other route on this controller is a literal path ('assignments',
  // 'list', 'profile', 'classes', ...), so ':id' here can never shadow
  // them regardless of match order. Reuses getProfile() -- it already
  // scopes by (teacherId, schoolId) only, with no restriction to the
  // caller's own id, so it's exactly the read a school_admin viewing
  // another teacher's profile needs. Roles match SearchController's, not
  // just 'school_admin', since accountant/staff can already see a
  // teacher's name/phone in a search result and shouldn't hit a 403
  // opening it.
  // ---------------------------------------------------------------------
  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  async findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const { user: teacher, assignments } = await this.teacherService.getProfile(id, schoolId);
    return toTeacherProfileView(teacher, assignments);
  }
}
