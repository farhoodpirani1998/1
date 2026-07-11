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
exports.TimetableService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const timetable_entry_entity_1 = require("./entities/timetable-entry.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const teacher_assignment_entity_1 = require("../teacher/entities/teacher-assignment.entity");
const roles_enum_1 = require("../../common/authorization/roles.enum");
const ENTRY_RELATIONS = ['grade', 'subject', 'teacher'];
let TimetableService = class TimetableService {
    constructor(timetableRepo, academicYearRepo, gradeRepo, subjectRepo, userRepo, studentRepo, parentStudentRepo, assignmentRepo) {
        this.timetableRepo = timetableRepo;
        this.academicYearRepo = academicYearRepo;
        this.gradeRepo = gradeRepo;
        this.subjectRepo = subjectRepo;
        this.userRepo = userRepo;
        this.studentRepo = studentRepo;
        this.parentStudentRepo = parentStudentRepo;
        this.assignmentRepo = assignmentRepo;
    }
    async create(dto, schoolId) {
        await this.assertRelationsInSchool(dto, schoolId);
        this.assertTimeRangeValid(dto.startTime, dto.endTime);
        await this.assertAssigned(dto.teacherId, dto.gradeId, dto.subjectId, schoolId);
        await this.assertNoOverlap(dto, schoolId);
        const entry = this.timetableRepo.create({
            schoolId,
            academicYearId: dto.academicYearId,
            gradeId: dto.gradeId,
            subjectId: dto.subjectId,
            teacherId: dto.teacherId,
            weekday: dto.weekday,
            startTime: dto.startTime,
            endTime: dto.endTime,
            room: dto.room ?? null,
        });
        const saved = await this.timetableRepo.save(entry);
        return this.findOneOrThrow(saved.id, schoolId);
    }
    async findAllForSchool(schoolId, query) {
        return this.timetableRepo.find({
            where: {
                schoolId,
                ...(query.gradeId ? { gradeId: query.gradeId } : {}),
                ...(query.teacherId ? { teacherId: query.teacherId } : {}),
                ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
            },
            relations: ENTRY_RELATIONS,
            order: { weekday: 'ASC', startTime: 'ASC' },
        });
    }
    async update(id, dto, schoolId) {
        const entry = await this.timetableRepo.findOne({ where: { id, schoolId } });
        if (!entry) {
            throw new common_1.NotFoundException('این برنامه یافت نشد');
        }
        const merged = {
            academicYearId: dto.academicYearId ?? entry.academicYearId,
            gradeId: dto.gradeId ?? entry.gradeId,
            subjectId: dto.subjectId ?? entry.subjectId,
            teacherId: dto.teacherId ?? entry.teacherId,
            weekday: dto.weekday ?? entry.weekday,
            startTime: dto.startTime ?? entry.startTime,
            endTime: dto.endTime ?? entry.endTime,
        };
        await this.assertRelationsInSchool(merged, schoolId);
        this.assertTimeRangeValid(merged.startTime, merged.endTime);
        await this.assertAssigned(merged.teacherId, merged.gradeId, merged.subjectId, schoolId);
        await this.assertNoOverlap(merged, schoolId, id);
        Object.assign(entry, merged, { room: dto.room !== undefined ? dto.room : entry.room });
        await this.timetableRepo.save(entry);
        return this.findOneOrThrow(id, schoolId);
    }
    async remove(id, schoolId) {
        const entry = await this.timetableRepo.findOne({ where: { id, schoolId } });
        if (!entry) {
            throw new common_1.NotFoundException('این برنامه یافت نشد');
        }
        await this.timetableRepo.remove(entry);
    }
    async findForTeacher(teacherId, schoolId) {
        return this.timetableRepo.find({
            where: { teacherId, schoolId },
            relations: ENTRY_RELATIONS,
            order: { weekday: 'ASC', startTime: 'ASC' },
        });
    }
    async findForParent(studentId, parentId, schoolId) {
        const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
        if (!link) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return this.timetableRepo.find({
            where: { gradeId: student.gradeId, schoolId },
            relations: ENTRY_RELATIONS,
            order: { weekday: 'ASC', startTime: 'ASC' },
        });
    }
    async findOneOrThrow(id, schoolId) {
        const entry = await this.timetableRepo.findOne({
            where: { id, schoolId },
            relations: ENTRY_RELATIONS,
        });
        if (!entry) {
            throw new common_1.NotFoundException('این برنامه یافت نشد');
        }
        return entry;
    }
    async assertRelationsInSchool(fields, schoolId) {
        const academicYear = await this.academicYearRepo.findOne({ where: { id: fields.academicYearId } });
        if (!academicYear) {
            throw new common_1.NotFoundException('سال تحصیلی یافت نشد');
        }
        if (academicYear.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
        }
        const grade = await this.gradeRepo.findOne({ where: { id: fields.gradeId } });
        if (!grade) {
            throw new common_1.NotFoundException('پایه یافت نشد');
        }
        if (grade.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این پایه متعلق به مدرسه دیگری است');
        }
        const subject = await this.subjectRepo.findOne({ where: { id: fields.subjectId } });
        if (!subject) {
            throw new common_1.NotFoundException('درس یافت نشد');
        }
        if (subject.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این درس متعلق به مدرسه دیگری است');
        }
        const teacher = await this.userRepo.findOne({ where: { id: fields.teacherId } });
        if (!teacher) {
            throw new common_1.NotFoundException('معلم یافت نشد');
        }
        if (teacher.role !== roles_enum_1.Role.TEACHER) {
            throw new common_1.BadRequestException('این کاربر نقش معلم ندارد');
        }
        if (teacher.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این معلم متعلق به مدرسه دیگری است');
        }
    }
    assertTimeRangeValid(startTime, endTime) {
        if (this.normalizeTime(startTime) >= this.normalizeTime(endTime)) {
            throw new common_1.BadRequestException('startTime باید قبل از endTime باشد');
        }
    }
    async assertAssigned(teacherId, gradeId, subjectId, schoolId) {
        const assignment = await this.assignmentRepo.findOne({
            where: { teacherId, gradeId, subjectId, schoolId },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('این معلم برای این پایه و درس تخصیص ندارد');
        }
    }
    async assertNoOverlap(fields, schoolId, excludeId) {
        const teacherRows = await this.timetableRepo.find({
            where: {
                schoolId,
                academicYearId: fields.academicYearId,
                weekday: fields.weekday,
                teacherId: fields.teacherId,
                ...(excludeId ? { id: (0, typeorm_2.Not)(excludeId) } : {}),
            },
        });
        if (teacherRows.some((row) => this.rangesOverlap(row, fields))) {
            throw new common_1.ConflictException('این معلم در این بازه زمانی برنامه دیگری دارد');
        }
        const gradeRows = await this.timetableRepo.find({
            where: {
                schoolId,
                academicYearId: fields.academicYearId,
                weekday: fields.weekday,
                gradeId: fields.gradeId,
                ...(excludeId ? { id: (0, typeorm_2.Not)(excludeId) } : {}),
            },
        });
        if (gradeRows.some((row) => this.rangesOverlap(row, fields))) {
            throw new common_1.ConflictException('این پایه در این بازه زمانی برنامه دیگری دارد');
        }
    }
    rangesOverlap(a, b) {
        return (this.normalizeTime(a.startTime) < this.normalizeTime(b.endTime) &&
            this.normalizeTime(b.startTime) < this.normalizeTime(a.endTime));
    }
    normalizeTime(t) {
        return t.slice(0, 5);
    }
};
exports.TimetableService = TimetableService;
exports.TimetableService = TimetableService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(timetable_entry_entity_1.TimetableEntry)),
    __param(1, (0, typeorm_1.InjectRepository)(academic_year_entity_1.AcademicYear)),
    __param(2, (0, typeorm_1.InjectRepository)(grade_entity_1.Grade)),
    __param(3, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(5, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(6, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __param(7, (0, typeorm_1.InjectRepository)(teacher_assignment_entity_1.TeacherAssignment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TimetableService);
//# sourceMappingURL=timetable.service.js.map