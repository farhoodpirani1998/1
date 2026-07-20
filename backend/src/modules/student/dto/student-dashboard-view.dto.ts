import { StudentSelfProfileView } from './student-self-profile-view.dto';
import { StudentHomeworkView } from './student-homework-view.dto';
import { ParentAttendanceView } from '../../attendance/dto/attendance-view.dto';
import { ParentAssessmentView } from '../../student-assessments/dto/assessment-view.dto';
import { ReportCardView } from '../../student-assessments/dto/report-card-view.dto';
import { RecipientAnnouncementView } from '../../announcements/dto/announcement-view.dto';
import { ParentStudentDocumentView } from '../../student-documents/dto/student-document-view.dto';
import { RecipientTimetableEntryView } from '../../timetable/dto/timetable-entry-view.dto';

/**
 * ADR-001 Task 4I-A: a single read-model that aggregates the same
 * student-safe views every other /student/* route already returns --
 * same "no new calculation, just reshape what already exists" reasoning
 * as StudentProfileView (modules/students/profile/student-profile-view.dto.ts)
 * for the admin/parent side. Every field here is produced by the exact
 * same service call + mapper StudentService's own per-resource methods
 * already use (see StudentService.getMyDashboard); this file only shapes
 * the combined response, it does not compute or reshape anything itself.
 *
 * `timetable` and `homework` carry the same full lists their own
 * GET /student/timetable and GET /student/homework routes return (a
 * grade's timetable/assigned homework isn't a history, so there's no
 * "recent" cut of either). `recentAnnouncements`, `recentAttendance`,
 * `recentAssessments`, and `recentDocuments` are bounded the same way
 * StudentProfileService's own dashboard-style aggregate already bounds
 * attendance/documents/homework for the admin profile view -- see
 * StudentService's RECENT_*_LIMIT constants.
 */
export interface StudentDashboardView {
  profile: StudentSelfProfileView;
  timetable: RecipientTimetableEntryView[];
  recentAnnouncements: RecipientAnnouncementView[];
  homework: StudentHomeworkView[];
  recentAttendance: ParentAttendanceView[];
  recentAssessments: ParentAssessmentView[];
  reportCard: ReportCardView;
  recentDocuments: ParentStudentDocumentView[];
}
