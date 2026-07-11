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
exports.AssessmentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const assessment_entity_1 = require("./entities/assessment.entity");
const subject_entity_1 = require("./entities/subject.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const report_card_view_dto_1 = require("./dto/report-card-view.dto");
const DEFAULT_MAX_SCORE = 20;
let AssessmentsService = class AssessmentsService {
    constructor(assessmentRepo, subjectRepo, studentRepo, parentStudentRepo) {
        this.assessmentRepo = assessmentRepo;
        this.subjectRepo = subjectRepo;
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
        const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
        if (!subject) {
            throw new common_1.NotFoundException('درس یافت نشد');
        }
        if (subject.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این درس متعلق به مدرسه دیگری است');
        }
        const maxScore = dto.maxScore ?? DEFAULT_MAX_SCORE;
        if (dto.score > maxScore) {
            throw new common_1.BadRequestException('نمره نمی‌تواند بیشتر از حداکثر نمره باشد');
        }
        const existing = await this.assessmentRepo.findOne({
            where: {
                studentId: dto.studentId,
                subjectId: dto.subjectId,
                academicYearId: student.academicYearId,
                term: dto.term,
            },
        });
        if (existing) {
            existing.score = dto.score;
            existing.maxScore = maxScore;
            existing.note = dto.note ?? null;
            existing.recordedById = recordedById;
            return this.assessmentRepo.save(existing);
        }
        const assessment = this.assessmentRepo.create({
            schoolId,
            studentId: dto.studentId,
            subjectId: dto.subjectId,
            academicYearId: student.academicYearId,
            term: dto.term,
            score: dto.score,
            maxScore,
            note: dto.note ?? null,
            recordedById,
        });
        return this.assessmentRepo.save(assessment);
    }
    async findByStudent(studentId, schoolId) {
        await this.assertStudentInSchool(studentId, schoolId);
        return this.assessmentRepo.find({
            where: { studentId },
            relations: ['subject'],
            order: { createdAt: 'DESC' },
        });
    }
    async getReportCard(studentId, schoolId) {
        await this.assertStudentInSchool(studentId, schoolId);
        const assessments = await this.assessmentRepo.find({
            where: { studentId },
            relations: ['subject'],
            order: { term: 'ASC' },
        });
        return (0, report_card_view_dto_1.buildReportCard)(studentId, assessments);
    }
    async findForParent(studentId, parentId, schoolId) {
        await this.assertParentLinked(studentId, parentId);
        return this.findByStudent(studentId, schoolId);
    }
    async getReportCardForParent(studentId, parentId, schoolId) {
        await this.assertParentLinked(studentId, parentId);
        return this.getReportCard(studentId, schoolId);
    }
    async findRecentForStudent(studentId, limit) {
        return this.assessmentRepo.find({
            where: { studentId },
            relations: ['subject'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
    async findAllForStudent(studentId) {
        return this.assessmentRepo.find({
            where: { studentId },
            relations: ['subject'],
        });
    }
    async assertStudentInSchool(studentId, schoolId) {
        const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
    }
    async assertParentLinked(studentId, parentId) {
        const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
        if (!link) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
    }
};
exports.AssessmentsService = AssessmentsService;
exports.AssessmentsService = AssessmentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(assessment_entity_1.Assessment)),
    __param(1, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __param(2, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(3, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AssessmentsService);
//# sourceMappingURL=assessments.service.js.map