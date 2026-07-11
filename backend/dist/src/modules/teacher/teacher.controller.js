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
exports.TeacherController = void 0;
const common_1 = require("@nestjs/common");
const teacher_service_1 = require("./teacher.service");
const create_teacher_assignment_dto_1 = require("./dto/create-teacher-assignment.dto");
const query_teacher_students_dto_1 = require("./dto/query-teacher-students.dto");
const create_attendance_dto_1 = require("../attendance/dto/create-attendance.dto");
const attendance_view_dto_1 = require("../attendance/dto/attendance-view.dto");
const create_assessment_dto_1 = require("../student-assessments/dto/create-assessment.dto");
const assessment_view_dto_1 = require("../student-assessments/dto/assessment-view.dto");
const teacher_view_dto_1 = require("./dto/teacher-view.dto");
const announcements_service_1 = require("../announcements/announcements.service");
const announcement_entity_1 = require("../announcements/entities/announcement.entity");
const announcement_view_dto_1 = require("../announcements/dto/announcement-view.dto");
const timetable_service_1 = require("../timetable/timetable.service");
const timetable_entry_view_dto_1 = require("../timetable/dto/timetable-entry-view.dto");
const homework_service_1 = require("../homework/homework.service");
const create_homework_dto_1 = require("../homework/dto/create-homework.dto");
const update_homework_dto_1 = require("../homework/dto/update-homework.dto");
const query_homework_dto_1 = require("../homework/dto/query-homework.dto");
const homework_view_dto_1 = require("../homework/dto/homework-view.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let TeacherController = class TeacherController {
    constructor(teacherService, announcementsService, timetableService, homeworkService) {
        this.teacherService = teacherService;
        this.announcementsService = announcementsService;
        this.timetableService = timetableService;
        this.homeworkService = homeworkService;
    }
    async assign(dto, schoolId) {
        const assignment = await this.teacherService.assign(dto, schoolId);
        return (0, teacher_view_dto_1.toTeacherAssignmentView)(assignment);
    }
    async listAssignments(teacherId, schoolId) {
        const assignments = await this.teacherService.listAssignments(schoolId, teacherId);
        return assignments.map(teacher_view_dto_1.toTeacherAssignmentView);
    }
    async unassign(id, schoolId) {
        await this.teacherService.unassign(id, schoolId);
    }
    async getProfile(user) {
        const { user: teacher, assignments } = await this.teacherService.getProfile(user.id, user.schoolId);
        return (0, teacher_view_dto_1.toTeacherProfileView)(teacher, assignments);
    }
    getMyClasses(user) {
        return this.teacherService.getMyClasses(user.id, user.schoolId);
    }
    getMySubjects(user) {
        return this.teacherService.getMySubjects(user.id, user.schoolId);
    }
    getMyStudents(query, user) {
        return this.teacherService.getMyStudents(user.id, user.schoolId, query);
    }
    async recordAttendance(dto, user) {
        const attendance = await this.teacherService.recordAttendance(dto, user.id, user.schoolId);
        return (0, attendance_view_dto_1.toAttendanceView)(attendance);
    }
    async recordAssessment(dto, user) {
        const assessment = await this.teacherService.recordAssessment(dto, user.id, user.schoolId);
        return (0, assessment_view_dto_1.toAssessmentView)(assessment);
    }
    async getMyAnnouncements(schoolId) {
        const announcements = await this.announcementsService.findForAudience(schoolId, announcement_entity_1.AnnouncementTargetType.TEACHERS);
        return announcements.map(announcement_view_dto_1.toRecipientAnnouncementView);
    }
    async getMyTimetable(user) {
        const entries = await this.timetableService.findForTeacher(user.id, user.schoolId);
        return entries.map(timetable_entry_view_dto_1.toTimetableEntryView);
    }
    async createHomework(dto, user) {
        const homework = await this.homeworkService.create(dto, user.id, user.schoolId);
        return (0, homework_view_dto_1.toHomeworkView)(homework);
    }
    async getMyHomework(query, user) {
        const homework = await this.homeworkService.findForTeacher(user.id, user.schoolId, query);
        return homework.map(homework_view_dto_1.toHomeworkView);
    }
    async updateHomework(id, dto, user) {
        const homework = await this.homeworkService.update(id, dto, user.id, user.schoolId);
        return (0, homework_view_dto_1.toHomeworkView)(homework);
    }
    async deleteHomework(id, user) {
        await this.homeworkService.remove(id, user.id, user.schoolId);
    }
};
exports.TeacherController = TeacherController;
__decorate([
    (0, common_1.Post)('assignments'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_teacher_assignment_dto_1.CreateTeacherAssignmentDto, String]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "assign", null);
__decorate([
    (0, common_1.Get)('assignments'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Query)('teacherId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "listAssignments", null);
__decorate([
    (0, common_1.Delete)('assignments/:id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "unassign", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Get)('classes'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TeacherController.prototype, "getMyClasses", null);
__decorate([
    (0, common_1.Get)('subjects'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TeacherController.prototype, "getMySubjects", null);
__decorate([
    (0, common_1.Get)('students'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_teacher_students_dto_1.QueryTeacherStudentsDto, Object]),
    __metadata("design:returntype", void 0)
], TeacherController.prototype, "getMyStudents", null);
__decorate([
    (0, common_1.Post)('attendance'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_attendance_dto_1.CreateAttendanceDto, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "recordAttendance", null);
__decorate([
    (0, common_1.Post)('assessments'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_assessment_dto_1.CreateAssessmentDto, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "recordAssessment", null);
__decorate([
    (0, common_1.Get)('announcements'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "getMyAnnouncements", null);
__decorate([
    (0, common_1.Get)('timetable'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "getMyTimetable", null);
__decorate([
    (0, common_1.Post)('homework'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_homework_dto_1.CreateHomeworkDto, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "createHomework", null);
__decorate([
    (0, common_1.Get)('homework'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_homework_dto_1.QueryHomeworkDto, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "getMyHomework", null);
__decorate([
    (0, common_1.Put)('homework/:id'),
    (0, roles_decorator_1.Roles)('teacher'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_homework_dto_1.UpdateHomeworkDto, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "updateHomework", null);
__decorate([
    (0, common_1.Delete)('homework/:id'),
    (0, roles_decorator_1.Roles)('teacher'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TeacherController.prototype, "deleteHomework", null);
exports.TeacherController = TeacherController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('teacher'),
    __metadata("design:paramtypes", [teacher_service_1.TeacherService,
        announcements_service_1.AnnouncementsService,
        timetable_service_1.TimetableService,
        homework_service_1.HomeworkService])
], TeacherController);
//# sourceMappingURL=teacher.controller.js.map