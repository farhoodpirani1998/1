import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { QueryTeacherStudentsDto } from './dto/query-teacher-students.dto';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { toAttendanceView } from '../attendance/dto/attendance-view.dto';
import { CreateAssessmentDto } from '../student-assessments/dto/create-assessment.dto';
import { toAssessmentView } from '../student-assessments/dto/assessment-view.dto';
import { toTeacherProfileView, toTeacherAssignmentView, toTeacherListItemView } from './dto/teacher-view.dto';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementTargetType } from '../announcements/entities/announcement.entity';
import { toRecipientAnnouncementView } from '../announcements/dto/announcement-view.dto';
import { TimetableService } from '../timetable/timetable.service';
import { toTimetableEntryView } from '../timetable/dto/timetable-entry-view.dto';
import { HomeworkService } from '../homework/homework.service';
import { CreateHomeworkDto } from '../homework/dto/create-homework.dto';
import { UpdateHomeworkDto } from '../homework/dto/update-homework.dto';
import { QueryHomeworkDto } from '../homework/dto/query-homework.dto';
import { toHomeworkView } from '../homework/dto/homework-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
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

  // Recording/correcting attendance for one of the teacher's own assigned
  // classes. TeacherService.recordAttendance() checks the assignment
  // before delegating to AttendanceService.record(), which owns every
  // other piece of business logic (upsert-on-resubmit, academicYearId
  // derivation) unchanged.
  @Post('attendance')
  @Roles('teacher')
  async recordAttendance(@Body() dto: CreateAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    const attendance = await this.teacherService.recordAttendance(dto, user.id, user.schoolId);
    return toAttendanceView(attendance);
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

  // Phase 5H: School Announcements. Read-only, teacher-scoped: only
  // announcements targeted at 'all' or 'teachers', within the caller's
  // own school -- AnnouncementsService.findForAudience() enforces both,
  // the audience is hardcoded here (never taken from the request), same
  // "caller can't widen their own view" reasoning as every other
  // audience-scoped read in this codebase.
  @Get('announcements')
  @Roles('teacher')
  async getMyAnnouncements(@CurrentUser('schoolId') schoolId: string) {
    const announcements = await this.announcementsService.findForAudience(
      schoolId,
      AnnouncementTargetType.TEACHERS,
    );
    return announcements.map(toRecipientAnnouncementView);
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

  @Post('homework')
  @Roles('teacher')
  async createHomework(@Body() dto: CreateHomeworkDto, @CurrentUser() user: AuthenticatedUser) {
    const homework = await this.homeworkService.create(dto, user.id, user.schoolId);
    return toHomeworkView(homework);
  }

  @Get('homework')
  @Roles('teacher')
  async getMyHomework(@Query() query: QueryHomeworkDto, @CurrentUser() user: AuthenticatedUser) {
    const homework = await this.homeworkService.findForTeacher(user.id, user.schoolId, query);
    return homework.map(toHomeworkView);
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
}
