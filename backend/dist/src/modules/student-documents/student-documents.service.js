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
exports.StudentDocumentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_document_entity_1 = require("./entities/student-document.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const RECENT_DOCUMENTS_LIMIT = 10;
let StudentDocumentsService = class StudentDocumentsService {
    constructor(documentRepo, studentRepo, parentStudentRepo) {
        this.documentRepo = documentRepo;
        this.studentRepo = studentRepo;
        this.parentStudentRepo = parentStudentRepo;
    }
    async create(studentId, dto, schoolId, uploadedById) {
        await this.assertStudentInSchool(studentId, schoolId);
        const document = this.documentRepo.create({
            schoolId,
            studentId,
            title: dto.title,
            documentType: dto.documentType,
            fileUrl: dto.fileUrl,
            description: dto.description ?? null,
            uploadedById,
        });
        return this.documentRepo.save(document);
    }
    async findByStudent(studentId, schoolId) {
        await this.assertStudentInSchool(studentId, schoolId);
        return this.documentRepo.find({
            where: { studentId },
            order: { createdAt: 'DESC' },
        });
    }
    async findForParent(studentId, parentId, schoolId) {
        await this.assertParentLinked(studentId, parentId);
        return this.findByStudent(studentId, schoolId);
    }
    async remove(id, schoolId) {
        const document = await this.documentRepo.findOne({ where: { id, schoolId } });
        if (!document) {
            throw new common_1.NotFoundException('سند یافت نشد');
        }
        await this.documentRepo.remove(document);
    }
    async findRecentForStudent(studentId, limit = RECENT_DOCUMENTS_LIMIT) {
        return this.documentRepo.find({
            where: { studentId },
            order: { createdAt: 'DESC' },
            take: limit,
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
exports.StudentDocumentsService = StudentDocumentsService;
exports.StudentDocumentsService = StudentDocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_document_entity_1.StudentDocument)),
    __param(1, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(2, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StudentDocumentsService);
//# sourceMappingURL=student-documents.service.js.map