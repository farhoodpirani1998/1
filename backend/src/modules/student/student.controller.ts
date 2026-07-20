import { Controller, Get, UseGuards } from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/authorization/roles.enum';
import { StudentSelfProfileView } from './dto/student-self-profile-view.dto';
import { ParentAttendanceView } from '../attendance/dto/attendance-view.dto';
import { ParentAssessmentView } from '../student-assessments/dto/assessment-view.dto';
import { ReportCardView } from '../student-assessments/dto/report-card-view.dto';
import { StudentHomeworkView } from './dto/student-homework-view.dto';
import { RecipientAnnouncementView } from '../announcements/dto/announcement-view.dto';
import { ParentStudentDocumentView } from '../student-documents/dto/student-document-view.dto';
import { RecipientTimetableEntryView } from '../timetable/dto/timetable-entry-view.dto';
import { StudentDashboardView } from './dto/student-dashboard-view.dto';

// ADR-001 Task 4A-2: first live /student/* route. Role.STUDENT-only,
// same isolation shape as ParentController/TeacherController. Resolves
// "which student am I" entirely from CurrentUser (id, schoolId) via
// StudentService.getMyProfile — never from a client-supplied studentId,
// same as ADR-001 §9/§10 and StudentService's own doc comment require.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  // ADR-001 Task 4B: resolves entirely via CurrentUser -> StudentUser ->
  // Student (schoolId re-checked in StudentService.getMyProfile) and
  // returns StudentSelfProfileView -- deliberately not the rich
  // admin-facing aggregate in
  // modules/students/profile/student-profile-view.dto.ts. No new
  // business logic: this route just reuses getMyProfile the same way
  // ParentController's routes reuse ParentService.findMyStudent().
  // (4B cleanup: this used to also be exposed at GET /student/me --
  // that duplicate route was removed, /student/profile is now the only
  // route onto getMyProfile.)
  @Roles(Role.STUDENT)
  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<StudentSelfProfileView> {
    return this.studentService.getMyProfile(user.id, user.schoolId);
  }

  // ADR-001 Task 4C: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as getProfile above. Delegates to
  // StudentService.getMyAttendance, which resolves StudentUser -> Student
  // (404 if unlinked or cross-school) and then reuses
  // AttendanceService.findByStudent -- no new attendance logic here or in
  // the service.
  @Roles(Role.STUDENT)
  @Get('attendance')
  getAttendance(@CurrentUser() user: AuthenticatedUser): Promise<ParentAttendanceView[]> {
    return this.studentService.getMyAttendance(user.id, user.schoolId);
  }

  // ADR-001 Task 4D: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as getAttendance above. Delegates to
  // StudentService.getMyAssessments, which resolves StudentUser -> Student
  // (404 if unlinked or cross-school) and then reuses
  // AssessmentsService.findByStudent -- no new assessment logic here or in
  // the service. Returns the existing ParentAssessmentView shape, same
  // precedent as reusing ParentAttendanceView for /student/attendance.
  @Roles(Role.STUDENT)
  @Get('assessments')
  getAssessments(@CurrentUser() user: AuthenticatedUser): Promise<ParentAssessmentView[]> {
    return this.studentService.getMyAssessments(user.id, user.schoolId);
  }

  // ADR-001 Task 4D: the authenticated student's own report card. Same
  // resolution shape as every other /student/* route. Delegates to
  // StudentService.getMyReportCard, which reuses
  // AssessmentsService.getReportCard as-is -- ReportCardView is already
  // caller-agnostic (shared with the staff and parent report-card routes),
  // so no student-specific reshaping is needed here.
  @Roles(Role.STUDENT)
  @Get('report-card')
  getReportCard(@CurrentUser() user: AuthenticatedUser): Promise<ReportCardView> {
    return this.studentService.getMyReportCard(user.id, user.schoolId);
  }

  // ADR-001 Task 4E: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as every other /student/* route.
  // Delegates to StudentService.getMyHomework, which resolves StudentUser
  // -> Student (404 if unlinked or cross-school) and then reuses
  // HomeworkService.findForStudent (grade-derived list) and
  // HomeworkSubmissionService.findAllForStudent (every submission this
  // same resolved student has, fetched once and matched in memory) -- no
  // new homework/submission logic here or in the service.
  @Roles(Role.STUDENT)
  @Get('homework')
  getHomework(@CurrentUser() user: AuthenticatedUser): Promise<StudentHomeworkView[]> {
    return this.studentService.getMyHomework(user.id, user.schoolId);
  }

  // ADR-001 Task 4F: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as every other /student/* route.
  // Delegates to StudentService.getMyAnnouncements, which resolves
  // StudentUser -> Student (404 if unlinked or cross-school) and then
  // reuses AnnouncementsService.findForAudience(schoolId,
  // AnnouncementTargetType.STUDENTS) -- the same audience-scoped read
  // ParentController/TeacherController already use for their own
  // announcements routes, no new visibility logic here or in the service.
  @Roles(Role.STUDENT)
  @Get('announcements')
  getAnnouncements(@CurrentUser() user: AuthenticatedUser): Promise<RecipientAnnouncementView[]> {
    return this.studentService.getMyAnnouncements(user.id, user.schoolId);
  }

  // ADR-001 Task 4G: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as every other /student/* route.
  // Delegates to StudentService.getMyDocuments, which resolves
  // StudentUser -> Student (404 if unlinked or cross-school) and then
  // reuses StudentDocumentsService.findByStudent -- the same read
  // ParentController's GET /parent/students/:id/documents already uses,
  // no new document logic here or in the service.
  @Roles(Role.STUDENT)
  @Get('documents')
  getDocuments(@CurrentUser() user: AuthenticatedUser): Promise<ParentStudentDocumentView[]> {
    return this.studentService.getMyDocuments(user.id, user.schoolId);
  }

  // ADR-001 Task 4H: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as every other /student/* route.
  // Delegates to StudentService.getMyTimetable, which resolves
  // StudentUser -> Student (404 if unlinked or cross-school) and then
  // reuses TimetableService.findAllForSchool(), narrowed to the resolved
  // student's own gradeId -- the same (schoolId, gradeId)-scoped read
  // ParentController's GET /parent/students/:id/timetable already
  // returns for a linked child, no new timetable logic here or in the
  // service.
  @Roles(Role.STUDENT)
  @Get('timetable')
  getTimetable(@CurrentUser() user: AuthenticatedUser): Promise<RecipientTimetableEntryView[]> {
    return this.studentService.getMyTimetable(user.id, user.schoolId);
  }

  // ADR-001 Task 4I-B: same "resolve entirely via CurrentUser, no
  // client-supplied studentId" shape as every other /student/* route.
  // Delegates to StudentService.getMyDashboard (Task 4I-A) -- no new
  // business logic here, just wiring the route the same one-line way
  // every other /student/* endpoint delegates to its own StudentService
  // method.
  @Roles(Role.STUDENT)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<StudentDashboardView> {
    return this.studentService.getMyDashboard(user.id, user.schoolId);
  }
}
