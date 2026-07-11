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
exports.StudentProfileService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_entity_1 = require("../entities/student.entity");
const parent_student_entity_1 = require("../../parent/entities/parent-student.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const roles_enum_1 = require("../../../common/authorization/roles.enum");
const reports_service_1 = require("../../reports/reports.service");
const attendance_service_1 = require("../../attendance/attendance.service");
const assessments_service_1 = require("../../student-assessments/assessments.service");
const student_documents_service_1 = require("../../student-documents/student-documents.service");
const homework_service_1 = require("../../homework/homework.service");
const student_profile_view_dto_1 = require("./student-profile-view.dto");
const RECENT_ATTENDANCE_LIMIT = 10;
const RECENT_DOCUMENTS_LIMIT = 10;
const RECENT_HOMEWORK_LIMIT = 10;
const PROFILE_RELATIONS = ['guardian', 'grade', 'academicYear', 'school'];
let StudentProfileService = class StudentProfileService {
    constructor(studentRepo, parentStudentRepo, userRepo, reportsService, attendanceService, assessmentsService, studentDocumentsService, homeworkService) {
        this.studentRepo = studentRepo;
        this.parentStudentRepo = parentStudentRepo;
        this.userRepo = userRepo;
        this.reportsService = reportsService;
        this.attendanceService = attendanceService;
        this.assessmentsService = assessmentsService;
        this.studentDocumentsService = studentDocumentsService;
        this.homeworkService = homeworkService;
    }
    async getForSchoolAdmin(studentId, schoolId) {
        const student = await this.loadStudent(studentId, schoolId);
        return this.assemble(student, schoolId);
    }
    async getForParent(studentId, parentId, schoolId) {
        const link = await this.parentStudentRepo.findOne({
            where: { parentId, studentId },
        });
        if (!link) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        const student = await this.loadStudent(studentId, schoolId);
        return this.assemble(student, schoolId);
    }
    async loadStudent(studentId, schoolId) {
        const student = await this.studentRepo.findOne({
            where: { id: studentId, schoolId },
            relations: PROFILE_RELATIONS,
        });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return student;
    }
    async assemble(student, schoolId) {
        const statement = await this.reportsService.studentStatement(student.id, schoolId);
        const parentUsers = await this.userRepo
            .createQueryBuilder('user')
            .innerJoin('parent_students', 'ps', 'ps.parent_id = user.id')
            .where('ps.student_id = :studentId', { studentId: student.id })
            .andWhere('user.schoolId = :schoolId', { schoolId })
            .andWhere('user.role = :role', { role: roles_enum_1.Role.PARENT })
            .getMany();
        const attendanceRecords = await this.attendanceService.findRecentForStudent(student.id, RECENT_ATTENDANCE_LIMIT);
        const assessmentRecords = await this.assessmentsService.findAllForStudent(student.id);
        const documentRecords = await this.studentDocumentsService.findRecentForStudent(student.id, RECENT_DOCUMENTS_LIMIT);
        const homeworkRecords = await this.homeworkService.findRecentForGrade(student.gradeId, schoolId, RECENT_HOMEWORK_LIMIT);
        return (0, student_profile_view_dto_1.buildStudentProfileView)({
            student,
            statement,
            parentUsers,
            attendanceRecords,
            assessmentRecords,
            documentRecords,
            homeworkRecords,
        });
    }
};
exports.StudentProfileService = StudentProfileService;
exports.StudentProfileService = StudentProfileService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(1, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        reports_service_1.ReportsService,
        attendance_service_1.AttendanceService,
        assessments_service_1.AssessmentsService,
        student_documents_service_1.StudentDocumentsService,
        homework_service_1.HomeworkService])
], StudentProfileService);
//# sourceMappingURL=student-profile.service.js.map