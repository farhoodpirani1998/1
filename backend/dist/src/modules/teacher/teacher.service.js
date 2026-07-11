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
exports.TeacherService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const teacher_assignment_entity_1 = require("./entities/teacher-assignment.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const attendance_service_1 = require("../attendance/attendance.service");
const assessments_service_1 = require("../student-assessments/assessments.service");
const roles_enum_1 = require("../../common/authorization/roles.enum");
const ASSIGNMENT_RELATIONS = ['grade', 'subject'];
let TeacherService = class TeacherService {
    constructor(assignmentRepo, userRepo, studentRepo, gradeRepo, subjectRepo, attendanceService, assessmentsService) {
        this.assignmentRepo = assignmentRepo;
        this.userRepo = userRepo;
        this.studentRepo = studentRepo;
        this.gradeRepo = gradeRepo;
        this.subjectRepo = subjectRepo;
        this.attendanceService = attendanceService;
        this.assessmentsService = assessmentsService;
    }
    async assign(dto, schoolId) {
        const teacher = await this.userRepo.findOne({ where: { id: dto.teacherId } });
        if (!teacher) {
            throw new common_1.NotFoundException('معلم یافت نشد');
        }
        if (teacher.role !== roles_enum_1.Role.TEACHER) {
            throw new common_1.BadRequestException('این کاربر نقش معلم ندارد');
        }
        if (teacher.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این معلم متعلق به مدرسه دیگری است');
        }
        const grade = await this.gradeRepo.findOne({ where: { id: dto.gradeId } });
        if (!grade) {
            throw new common_1.NotFoundException('پایه یافت نشد');
        }
        if (grade.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این پایه متعلق به مدرسه دیگری است');
        }
        const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
        if (!subject) {
            throw new common_1.NotFoundException('درس یافت نشد');
        }
        if (subject.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این درس متعلق به مدرسه دیگری است');
        }
        const existing = await this.assignmentRepo.findOne({
            where: { teacherId: dto.teacherId, gradeId: dto.gradeId, subjectId: dto.subjectId },
        });
        if (existing) {
            return existing;
        }
        const assignment = this.assignmentRepo.create({
            schoolId,
            teacherId: dto.teacherId,
            gradeId: dto.gradeId,
            subjectId: dto.subjectId,
        });
        return this.assignmentRepo.save(assignment);
    }
    async listAssignments(schoolId, teacherId) {
        return this.assignmentRepo.find({
            where: teacherId ? { schoolId, teacherId } : { schoolId },
            relations: ASSIGNMENT_RELATIONS,
            order: { createdAt: 'DESC' },
        });
    }
    async unassign(id, schoolId) {
        const assignment = await this.assignmentRepo.findOne({ where: { id, schoolId } });
        if (!assignment) {
            throw new common_1.NotFoundException('این تخصیص یافت نشد');
        }
        await this.assignmentRepo.delete(id);
    }
    async getMyAssignments(teacherId, schoolId) {
        return this.assignmentRepo.find({
            where: { teacherId, schoolId },
            relations: ASSIGNMENT_RELATIONS,
            order: { createdAt: 'ASC' },
        });
    }
    async getProfile(teacherId, schoolId) {
        const user = await this.userRepo.findOne({ where: { id: teacherId, schoolId } });
        if (!user) {
            throw new common_1.NotFoundException('معلم یافت نشد');
        }
        const assignments = await this.getMyAssignments(teacherId, schoolId);
        return { user, assignments };
    }
    async getMyClasses(teacherId, schoolId) {
        const assignments = await this.getMyAssignments(teacherId, schoolId);
        return this.uniqueByGrade(assignments).map((a) => a.grade);
    }
    async getMySubjects(teacherId, schoolId) {
        const assignments = await this.getMyAssignments(teacherId, schoolId);
        const seen = new Set();
        const subjects = [];
        for (const a of assignments) {
            if (!seen.has(a.subjectId)) {
                seen.add(a.subjectId);
                subjects.push(a.subject);
            }
        }
        return subjects;
    }
    async getMyStudents(teacherId, schoolId, query) {
        const assignedGradeIds = await this.assignedGradeIds(teacherId, schoolId);
        let gradeIds = assignedGradeIds;
        if (query.gradeId) {
            if (!assignedGradeIds.includes(query.gradeId)) {
                throw new common_1.ForbiddenException('شما به این کلاس دسترسی ندارید');
            }
            gradeIds = [query.gradeId];
        }
        if (gradeIds.length === 0) {
            return [];
        }
        return this.studentRepo.find({
            where: { schoolId, gradeId: (0, typeorm_2.In)(gradeIds) },
            relations: ['grade'],
            order: { fullName: 'ASC' },
        });
    }
    async recordAttendance(dto, teacherId, schoolId) {
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        const assignedGradeIds = await this.assignedGradeIds(teacherId, schoolId);
        if (!assignedGradeIds.includes(student.gradeId)) {
            throw new common_1.ForbiddenException('شما به کلاس این دانش‌آموز دسترسی ندارید');
        }
        return this.attendanceService.record(dto, schoolId, teacherId);
    }
    async recordAssessment(dto, teacherId, schoolId) {
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        const assignment = await this.assignmentRepo.findOne({
            where: { teacherId, schoolId, gradeId: student.gradeId, subjectId: dto.subjectId },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('شما برای این کلاس و درس تخصیص ندارید');
        }
        return this.assessmentsService.record(dto, schoolId, teacherId);
    }
    uniqueByGrade(assignments) {
        const seen = new Set();
        const result = [];
        for (const a of assignments) {
            if (!seen.has(a.gradeId)) {
                seen.add(a.gradeId);
                result.push(a);
            }
        }
        return result;
    }
    async assignedGradeIds(teacherId, schoolId) {
        const assignments = await this.assignmentRepo.find({
            where: { teacherId, schoolId },
        });
        return [...new Set(assignments.map((a) => a.gradeId))];
    }
};
exports.TeacherService = TeacherService;
exports.TeacherService = TeacherService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(teacher_assignment_entity_1.TeacherAssignment)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(3, (0, typeorm_1.InjectRepository)(grade_entity_1.Grade)),
    __param(4, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        attendance_service_1.AttendanceService,
        assessments_service_1.AssessmentsService])
], TeacherService);
//# sourceMappingURL=teacher.service.js.map