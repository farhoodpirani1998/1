"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentController = void 0;
const common_1 = require("@nestjs/common");
const parent_service_1 = require("./parent.service");
const link_parent_dto_1 = require("./dto/link-parent.dto");
const parent_student_view_dto_1 = require("./dto/parent-student-view.dto");
const parent_tuition_view_dto_1 = require("./dto/parent-tuition-view.dto");
const parent_installments_view_dto_1 = require("./dto/parent-installments-view.dto");
const parent_payments_view_dto_1 = require("./dto/parent-payments-view.dto");
const parent_notification_view_dto_1 = require("./dto/parent-notification-view.dto");
const query_parent_notifications_dto_1 = require("./dto/query-parent-notifications.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const student_profile_service_1 = require("../students/profile/student-profile.service");
const attendance_service_1 = require("../attendance/attendance.service");
const attendance_view_dto_1 = require("../attendance/dto/attendance-view.dto");
const assessments_service_1 = require("../student-assessments/assessments.service");
const assessment_view_dto_1 = require("../student-assessments/dto/assessment-view.dto");
const announcements_service_1 = require("../announcements/announcements.service");
const announcement_entity_1 = require("../announcements/entities/announcement.entity");
const announcement_view_dto_1 = require("../announcements/dto/announcement-view.dto");
const student_documents_service_1 = require("../student-documents/student-documents.service");
const student_document_view_dto_1 = require("../student-documents/dto/student-document-view.dto");
const timetable_service_1 = require("../timetable/timetable.service");
const timetable_entry_view_dto_1 = require("../timetable/dto/timetable-entry-view.dto");
const homework_service_1 = require("../homework/homework.service");
const homework_view_dto_1 = require("../homework/dto/homework-view.dto");
let ParentController = class ParentController {
    constructor(parentService, studentProfileService, attendanceService, assessmentsService, announcementsService, studentDocumentsService, timetableService, homeworkService) {
        this.parentService = parentService;
        this.studentProfileService = studentProfileService;
        this.attendanceService = attendanceService;
        this.assessmentsService = assessmentsService;
        this.announcementsService = announcementsService;
        this.studentDocumentsService = studentDocumentsService;
        this.timetableService = timetableService;
        this.homeworkService = homeworkService;
    }
    async findMyStudents(user) {
        const students = await this.parentService.findMyStudents(user.id, user.schoolId);
        return students.map(parent_student_view_dto_1.toParentStudentView);
    }
    async findMyStudent(id, user) {
        const student = await this.parentService.findMyStudent(id, user.id, user.schoolId);
        return (0, parent_student_view_dto_1.toParentStudentView)(student);
    }
    link(dto, schoolId) {
        return this.parentService.link(dto, schoolId);
    }
    async unlink(id, schoolId) {
        await this.parentService.unlink(id, schoolId);
    }
    async getStudentTuition(studentId, user) {
        const plan = await this.parentService.getStudentTuition(studentId, user.id, user.schoolId);
        return (0, parent_tuition_view_dto_1.toParentTuitionView)({
            ...plan,
            academicYear: plan.academicYear ? { ...plan.academicYear, title: plan.academicYear.title } : undefined,
        });
    }
    async getStudentInstallments(studentId, user) {
        const installments = await this.parentService.getStudentInstallments(studentId, user.id, user.schoolId);
        return installments.map(parent_installments_view_dto_1.toParentInstallmentView);
    }
    async getStudentPaymentHistory(studentId, user) {
        const payments = await this.parentService.getStudentPaymentHistory(studentId, user.id, user.schoolId);
        return payments.map(parent_payments_view_dto_1.toParentPaymentView);
    }
    async getStudentProfile(studentId, user) {
        return this.studentProfileService.getForParent(studentId, user.id, user.schoolId);
    }
    async getStudentAttendance(studentId, user) {
        const records = await this.attendanceService.findForParent(studentId, user.id, user.schoolId);
        return records.map(attendance_view_dto_1.toParentAttendanceView);
    }
    async getMyNotifications(query, user) {
        const notifications = await this.parentService.getMyNotifications(user.id, user.schoolId, query);
        return notifications.map(parent_notification_view_dto_1.toParentNotificationView);
    }
    async markNotificationRead(id, user) {
        const notification = await this.parentService.markNotificationRead(id, user.id, user.schoolId);
        return (0, parent_notification_view_dto_1.toParentNotificationView)(notification);
    }
    async getStudentAssessments(studentId, user) {
        const records = await this.assessmentsService.findForParent(studentId, user.id, user.schoolId);
        return records.map(assessment_view_dto_1.toParentAssessmentView);
    }
    async getStudentReportCard(studentId, user) {
        return this.assessmentsService.getReportCardForParent(studentId, user.id, user.schoolId);
    }
    async getMyAnnouncements(schoolId) {
        const announcements = await this.announcementsService.findForAudience(schoolId, announcement_entity_1.AnnouncementTargetType.PARENTS);
        return announcements.map(announcement_view_dto_1.toRecipientAnnouncementView);
    }
    async getStudentDocuments(studentId, user) {
        const documents = await this.studentDocumentsService.findForParent(studentId, user.id, user.schoolId);
        return documents.map(student_document_view_dto_1.toParentStudentDocumentView);
    }
    async getStudentTimetable(studentId, user) {
        const entries = await this.timetableService.findForParent(studentId, user.id, user.schoolId);
        return entries.map(timetable_entry_view_dto_1.toTimetableEntryView);
    }
    async getStudentHomework(studentId, user) {
        const homework = await this.homeworkService.findForParent(studentId, user.id, user.schoolId);
        return homework.map(homework_view_dto_1.toRecipientHomeworkView);
    }
};
exports.ParentController = ParentController;
__decorate([
    (0, common_1.Get)('students'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "findMyStudents", null);
__decorate([
    (0, common_1.Get)('students/:id'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "findMyStudent", null);
__decorate([
    (0, common_1.Post)('link'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [link_parent_dto_1.LinkParentDto, String]),
    __metadata("design:returntype", void 0)
], ParentController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)('link/:id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "unlink", null);
__decorate([
    (0, common_1.Get)('students/:id/tuition'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentTuition", null);
__decorate([
    (0, common_1.Get)('students/:id/installments'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentInstallments", null);
__decorate([
    (0, common_1.Get)('students/:id/payments'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentPaymentHistory", null);
__decorate([
    (0, common_1.Get)('students/:id/profile'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentProfile", null);
__decorate([
    (0, common_1.Get)('students/:id/attendance'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentAttendance", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_parent_notifications_dto_1.QueryParentNotificationsDto, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getMyNotifications", null);
__decorate([
    (0, common_1.Patch)('notifications/:id/read'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "markNotificationRead", null);
__decorate([
    (0, common_1.Get)('students/:id/assessments'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentAssessments", null);
__decorate([
    (0, common_1.Get)('students/:id/report-card'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentReportCard", null);
__decorate([
    (0, common_1.Get)('announcements'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getMyAnnouncements", null);
__decorate([
    (0, common_1.Get)('students/:id/documents'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentDocuments", null);
__decorate([
    (0, common_1.Get)('students/:id/timetable'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentTimetable", null);
__decorate([
    (0, common_1.Get)('students/:id/homework'),
    (0, roles_decorator_1.Roles)('parent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ParentController.prototype, "getStudentHomework", null);
exports.ParentController = ParentController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('parent'),
    __metadata("design:paramtypes", [parent_service_1.ParentService,
        student_profile_service_1.StudentProfileService,
        attendance_service_1.AttendanceService,
        assessments_service_1.AssessmentsService,
        announcements_service_1.AnnouncementsService,
        student_documents_service_1.StudentDocumentsService,
        timetable_service_1.TimetableService,
        homework_service_1.HomeworkService])
], ParentController);
//# sourceMappingURL=parent.controller.js.map