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
exports.HomeworkService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const homework_entity_1 = require("./entities/homework.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const teacher_assignment_entity_1 = require("../teacher/entities/teacher-assignment.entity");
const HOMEWORK_RELATIONS = ['grade', 'subject', 'teacher'];
const RECENT_HOMEWORK_LIMIT = 10;
let HomeworkService = class HomeworkService {
    constructor(homeworkRepo, academicYearRepo, gradeRepo, subjectRepo, studentRepo, parentStudentRepo, assignmentRepo) {
        this.homeworkRepo = homeworkRepo;
        this.academicYearRepo = academicYearRepo;
        this.gradeRepo = gradeRepo;
        this.subjectRepo = subjectRepo;
        this.studentRepo = studentRepo;
        this.parentStudentRepo = parentStudentRepo;
        this.assignmentRepo = assignmentRepo;
    }
    async create(dto, teacherId, schoolId) {
        await this.assertRelationsInSchool(dto, schoolId);
        await this.assertAssigned(teacherId, dto.gradeId, dto.subjectId, schoolId);
        const homework = this.homeworkRepo.create({
            schoolId,
            academicYearId: dto.academicYearId,
            gradeId: dto.gradeId,
            subjectId: dto.subjectId,
            teacherId,
            title: dto.title,
            description: dto.description,
            dueDate: dto.dueDate,
            attachmentUrl: dto.attachmentUrl ?? null,
        });
        const saved = await this.homeworkRepo.save(homework);
        return this.findOneOrThrow(saved.id, schoolId);
    }
    async update(id, dto, teacherId, schoolId) {
        const homework = await this.homeworkRepo.findOne({ where: { id, schoolId, teacherId } });
        if (!homework) {
            throw new common_1.NotFoundException('این تکلیف یافت نشد');
        }
        const merged = {
            academicYearId: dto.academicYearId ?? homework.academicYearId,
            gradeId: dto.gradeId ?? homework.gradeId,
            subjectId: dto.subjectId ?? homework.subjectId,
        };
        await this.assertRelationsInSchool(merged, schoolId);
        await this.assertAssigned(teacherId, merged.gradeId, merged.subjectId, schoolId);
        Object.assign(homework, merged, {
            title: dto.title ?? homework.title,
            description: dto.description ?? homework.description,
            dueDate: dto.dueDate ?? homework.dueDate,
            attachmentUrl: dto.attachmentUrl !== undefined ? dto.attachmentUrl : homework.attachmentUrl,
        });
        await this.homeworkRepo.save(homework);
        return this.findOneOrThrow(id, schoolId);
    }
    async remove(id, teacherId, schoolId) {
        const homework = await this.homeworkRepo.findOne({ where: { id, schoolId, teacherId } });
        if (!homework) {
            throw new common_1.NotFoundException('این تکلیف یافت نشد');
        }
        await this.homeworkRepo.remove(homework);
    }
    async findForTeacher(teacherId, schoolId, query = {}) {
        return this.homeworkRepo.find({
            where: {
                teacherId,
                schoolId,
                ...(query.gradeId ? { gradeId: query.gradeId } : {}),
                ...(query.subjectId ? { subjectId: query.subjectId } : {}),
                ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
            },
            relations: HOMEWORK_RELATIONS,
            order: { dueDate: 'ASC' },
        });
    }
    async findAllForSchool(schoolId, query = {}) {
        return this.homeworkRepo.find({
            where: {
                schoolId,
                ...(query.gradeId ? { gradeId: query.gradeId } : {}),
                ...(query.subjectId ? { subjectId: query.subjectId } : {}),
                ...(query.teacherId ? { teacherId: query.teacherId } : {}),
                ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
            },
            relations: HOMEWORK_RELATIONS,
            order: { dueDate: 'DESC' },
        });
    }
    async findForParent(studentId, parentId, schoolId) {
        await this.assertParentLinked(studentId, parentId);
        const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return this.homeworkRepo.find({
            where: { gradeId: student.gradeId, schoolId },
            relations: HOMEWORK_RELATIONS,
            order: { dueDate: 'DESC' },
        });
    }
    async findRecentForGrade(gradeId, schoolId, limit = RECENT_HOMEWORK_LIMIT) {
        return this.homeworkRepo.find({
            where: { gradeId, schoolId },
            relations: HOMEWORK_RELATIONS,
            order: { dueDate: 'DESC' },
            take: limit,
        });
    }
    async findOneOrThrow(id, schoolId) {
        const homework = await this.homeworkRepo.findOne({
            where: { id, schoolId },
            relations: HOMEWORK_RELATIONS,
        });
        if (!homework) {
            throw new common_1.NotFoundException('این تکلیف یافت نشد');
        }
        return homework;
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
    }
    async assertAssigned(teacherId, gradeId, subjectId, schoolId) {
        const assignment = await this.assignmentRepo.findOne({
            where: { teacherId, gradeId, subjectId, schoolId },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('این معلم برای این پایه و درس تخصیص ندارد');
        }
    }
    async assertParentLinked(studentId, parentId) {
        const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
        if (!link) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
    }
};
exports.HomeworkService = HomeworkService;
exports.HomeworkService = HomeworkService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(homework_entity_1.Homework)),
    __param(1, (0, typeorm_1.InjectRepository)(academic_year_entity_1.AcademicYear)),
    __param(2, (0, typeorm_1.InjectRepository)(grade_entity_1.Grade)),
    __param(3, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __param(4, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(5, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __param(6, (0, typeorm_1.InjectRepository)(teacher_assignment_entity_1.TeacherAssignment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], HomeworkService);
//# sourceMappingURL=homework.service.js.map