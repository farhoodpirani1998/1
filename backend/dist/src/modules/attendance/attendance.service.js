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
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const attendance_entity_1 = require("./entities/attendance.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
let AttendanceService = class AttendanceService {
    constructor(attendanceRepo, studentRepo, parentStudentRepo) {
        this.attendanceRepo = attendanceRepo;
        this.studentRepo = studentRepo;
        this.parentStudentRepo = parentStudentRepo;
    }
    async record(dto, schoolId, recordedById) {
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        if (student.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
        }
        const existing = await this.attendanceRepo.findOne({
            where: { studentId: dto.studentId, date: dto.date },
        });
        if (existing) {
            existing.status = dto.status;
            existing.note = dto.note ?? null;
            existing.recordedById = recordedById;
            return this.attendanceRepo.save(existing);
        }
        const attendance = this.attendanceRepo.create({
            schoolId,
            studentId: dto.studentId,
            academicYearId: student.academicYearId,
            date: dto.date,
            status: dto.status,
            note: dto.note ?? null,
            recordedById,
        });
        return this.attendanceRepo.save(attendance);
    }
    async findByStudent(studentId, schoolId) {
        await this.assertStudentInSchool(studentId, schoolId);
        return this.attendanceRepo.find({
            where: { studentId },
            order: { date: 'DESC' },
        });
    }
    async findByDate(date, schoolId, query) {
        if (!DATE_ONLY.test(date)) {
            throw new common_1.BadRequestException('فرمت تاریخ نامعتبر است (مورد انتظار: YYYY-MM-DD)');
        }
        const qb = this.attendanceRepo
            .createQueryBuilder('attendance')
            .leftJoinAndSelect('attendance.student', 'student')
            .where('attendance.schoolId = :schoolId', { schoolId })
            .andWhere('attendance.date = :date', { date });
        if (query.gradeId) {
            qb.andWhere('student.gradeId = :gradeId', { gradeId: query.gradeId });
        }
        if (query.academicYearId) {
            qb.andWhere('attendance.academicYearId = :academicYearId', {
                academicYearId: query.academicYearId,
            });
        }
        return qb.orderBy('student.fullName', 'ASC').getMany();
    }
    async findForParent(studentId, parentId, schoolId) {
        const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
        if (!link) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return this.findByStudent(studentId, schoolId);
    }
    async findRecentForStudent(studentId, limit) {
        return this.attendanceRepo.find({
            where: { studentId },
            order: { date: 'DESC' },
            take: limit,
        });
    }
    async assertStudentInSchool(studentId, schoolId) {
        const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(attendance_entity_1.Attendance)),
    __param(1, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(2, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map