import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ParentService } from './parent.service';
import { LinkParentDto } from './dto/link-parent.dto';
import { toParentStudentView } from './dto/parent-student-view.dto';
import { toParentTuitionView } from './dto/parent-tuition-view.dto';
import { toParentInstallmentView } from './dto/parent-installments-view.dto';
import { toParentPaymentView } from './dto/parent-payments-view.dto';
import { toParentNotificationView } from './dto/parent-notification-view.dto';
import { QueryParentNotificationsDto } from './dto/query-parent-notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
// Phase 5D: Student Profile.
import { StudentProfileService } from '../students/profile/student-profile.service';
// Phase 5E: Attendance.
import { AttendanceService } from '../attendance/attendance.service';
import { toParentAttendanceView } from '../attendance/dto/attendance-view.dto';
// Phase 5F: Student Assessment & Report Cards.
import { AssessmentsService } from '../student-assessments/assessments.service';
import { toParentAssessmentView } from '../student-assessments/dto/assessment-view.dto';
// Phase 5H: School Announcements.
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementTargetType } from '../announcements/entities/announcement.entity';
import { toRecipientAnnouncementView } from '../announcements/dto/announcement-view.dto';
// Phase 5I: Student Document Management.
import { StudentDocumentsService } from '../student-documents/student-documents.service';
import { toParentStudentDocumentView } from '../student-documents/dto/student-document-view.dto';
// Phase 5K: Timetable Foundation.
import { TimetableService } from '../timetable/timetable.service';
import { toTimetableEntryView } from '../timetable/dto/timetable-entry-view.dto';
// Phase 5L: Homework & Assignments.
import { HomeworkService } from '../homework/homework.service';
import { toRecipientHomeworkView } from '../homework/dto/homework-view.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent')
export class ParentController {
  constructor(
    private readonly parentService: ParentService,
    private readonly studentProfileService: StudentProfileService,
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
    // Phase 5H: GET /parent/announcements is served directly by
    // AnnouncementsService, same "dedicated portal controller reads a
    // shared service directly" shape this controller already uses for
    // AttendanceService / AssessmentsService.
    private readonly announcementsService: AnnouncementsService,
    // Phase 5I: GET /parent/students/:id/documents is served directly by
    // StudentDocumentsService, same "dedicated portal controller reads a
    // shared service directly" shape this controller already uses for
    // AttendanceService / AssessmentsService.
    private readonly studentDocumentsService: StudentDocumentsService,
    // Phase 5K: GET /parent/students/:id/timetable is served directly by
    // TimetableService, same "dedicated portal controller reads a shared
    // service directly" shape this controller already uses for
    // AttendanceService / AssessmentsService / StudentDocumentsService.
    private readonly timetableService: TimetableService,
    // Phase 5L: GET /parent/students/:id/homework is served directly by
    // HomeworkService, same "dedicated portal controller reads a shared
    // service directly" shape this controller already uses for
    // TimetableService / StudentDocumentsService.
    private readonly homeworkService: HomeworkService,
  ) {}

  // Read-only, parent-only: a parent only ever sees the students they're
  // explicitly linked to (see ParentService.findMyStudents), never a
  // school-wide list — unlike /students, which school_admin/accountant/
  // staff can browse freely.
  @Get('students')
  @Roles('parent')
  async findMyStudents(@CurrentUser() user: AuthenticatedUser) {
    const students = await this.parentService.findMyStudents(user.id, user.schoolId);
    return students.map(toParentStudentView);
  }

  @Get('students/:id')
  @Roles('parent')
  async findMyStudent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const student = await this.parentService.findMyStudent(id, user.id, user.schoolId);
    return toParentStudentView(student);
  }

  // Admin-side management of the relationship itself. Kept in this same
  // controller (rather than a separate module) since it's the only place
  // parent_students rows are created/removed — school_admin links a
  // parent account (created via POST /auth/register with role: 'parent')
  // to the student(s) that account should see.
  @Post('link')
  @Roles('school_admin')
  link(@Body() dto: LinkParentDto, @CurrentUser('schoolId') schoolId: string) {
    return this.parentService.link(dto, schoolId);
  }

  @Delete('link/:id')
  @Roles('school_admin')
  @HttpCode(204)
  async unlink(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.parentService.unlink(id, schoolId);
  }

  // Phase 5B: Parent tuition & payment access. Read-only endpoints for parents
  // to view their linked students' tuition plans, installments, and payment history.
  // All endpoints verify the parent owns the student before returning data.

  @Get('students/:id/tuition')
  @Roles('parent')
  async getStudentTuition(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const plan = await this.parentService.getStudentTuition(
      studentId,
      user.id,
      user.schoolId,
    );
    return toParentTuitionView({
      ...plan,
      academicYear: plan.academicYear ? { ...plan.academicYear, title: plan.academicYear.title } : undefined,
    } as any);
  }

  @Get('students/:id/installments')
  @Roles('parent')
  async getStudentInstallments(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const installments = await this.parentService.getStudentInstallments(
      studentId,
      user.id,
      user.schoolId,
    );
    return installments.map(toParentInstallmentView);
  }

  @Get('students/:id/payments')
  @Roles('parent')
  async getStudentPaymentHistory(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const payments = await this.parentService.getStudentPaymentHistory(
      studentId,
      user.id,
      user.schoolId,
    );
    return payments.map(toParentPaymentView);
  }

  // Phase 5D: Student Profile. Same "linked child only" rule as every
  // other /parent/students/:id/* route -- StudentProfileService.getForParent
  // checks the parent_students link before returning anything, so an
  // unlinked or cross-school id 404s the same way findMyStudent() does.
  @Get('students/:id/profile')
  @Roles('parent')
  async getStudentProfile(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentProfileService.getForParent(studentId, user.id, user.schoolId);
  }

  // Phase 5E: Attendance. Same "linked child only" rule as every other
  // /parent/students/:id/* route -- AttendanceService.findForParent checks
  // the parent_students link before returning anything, so an unlinked or
  // cross-school id 404s the same way findMyStudent() / getStudentProfile
  // do.
  @Get('students/:id/attendance')
  @Roles('parent')
  async getStudentAttendance(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const records = await this.attendanceService.findForParent(studentId, user.id, user.schoolId);
    return records.map(toParentAttendanceView);
  }

  // Phase 5C: Parent Notifications. Combined inbox across every student
  // this parent is linked to (payment-received / overdue / upcoming-due),
  // not scoped to one student like the endpoints above -- see
  // ParentService.getMyNotifications.
  @Get('notifications')
  @Roles('parent')
  async getMyNotifications(
    @Query() query: QueryParentNotificationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const notifications = await this.parentService.getMyNotifications(
      user.id,
      user.schoolId,
      query,
    );
    return notifications.map(toParentNotificationView);
  }

  @Patch('notifications/:id/read')
  @Roles('parent')
  async markNotificationRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const notification = await this.parentService.markNotificationRead(
      id,
      user.id,
      user.schoolId,
    );
    return toParentNotificationView(notification);
  }

  // Phase 5F: Student Assessment & Report Cards. Same "linked child only"
  // rule as every other /parent/students/:id/* route --
  // AssessmentsService.findForParent checks the parent_students link
  // before returning anything, so an unlinked or cross-school id 404s the
  // same way findMyStudent() / getStudentAttendance do.
  @Get('students/:id/assessments')
  @Roles('parent')
  async getStudentAssessments(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const records = await this.assessmentsService.findForParent(studentId, user.id, user.schoolId);
    return records.map(toParentAssessmentView);
  }

  @Get('students/:id/report-card')
  @Roles('parent')
  async getStudentReportCard(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessmentsService.getReportCardForParent(studentId, user.id, user.schoolId);
  }

  // Phase 5H: School Announcements. Not scoped to one student (a parent
  // may have several linked children in the same school, but the school's
  // announcements are the same for all of them) -- read-only, parent-scoped:
  // only announcements targeted at 'all' or 'parents', within the caller's
  // own school. Same "audience hardcoded here, never taken from the
  // request" reasoning as TeacherController.getMyAnnouncements.
  @Get('announcements')
  @Roles('parent')
  async getMyAnnouncements(@CurrentUser('schoolId') schoolId: string) {
    const announcements = await this.announcementsService.findForAudience(
      schoolId,
      AnnouncementTargetType.PARENTS,
    );
    return announcements.map(toRecipientAnnouncementView);
  }

  // Phase 5I: Student Document Management. Same "linked child only" rule
  // as every other /parent/students/:id/* route --
  // StudentDocumentsService.findForParent checks the parent_students link
  // before returning anything, so an unlinked or cross-school id 404s the
  // same way findMyStudent() / getStudentAssessments do.
  @Get('students/:id/documents')
  @Roles('parent')
  async getStudentDocuments(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const documents = await this.studentDocumentsService.findForParent(
      studentId,
      user.id,
      user.schoolId,
    );
    return documents.map(toParentStudentDocumentView);
  }

  // Phase 5K: Timetable Foundation. Same "linked child only" rule as every
  // other /parent/students/:id/* route -- TimetableService.findForParent
  // checks the parent_students link before returning anything, so an
  // unlinked or cross-school id 404s the same way findMyStudent() /
  // getStudentDocuments do. Returns the student's *grade* timetable (a
  // student doesn't have a schedule of their own).
  @Get('students/:id/timetable')
  @Roles('parent')
  async getStudentTimetable(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const entries = await this.timetableService.findForParent(studentId, user.id, user.schoolId);
    return entries.map(toTimetableEntryView);
  }

  // Phase 5L: Homework & Assignments. Same "linked child only" rule as
  // every other /parent/students/:id/* route -- HomeworkService.findForParent
  // checks the parent_students link before returning anything, so an
  // unlinked or cross-school id 404s the same way findMyStudent() /
  // getStudentTimetable do. Returns the student's *grade* homework (a
  // student doesn't have assignments of their own).
  @Get('students/:id/homework')
  @Roles('parent')
  async getStudentHomework(@Param('id') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    const homework = await this.homeworkService.findForParent(studentId, user.id, user.schoolId);
    return homework.map(toRecipientHomeworkView);
  }
}
