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
exports.DocumentsController = exports.StudentDocumentsController = void 0;
const common_1 = require("@nestjs/common");
const student_documents_service_1 = require("./student-documents.service");
const create_student_document_dto_1 = require("./dto/create-student-document.dto");
const student_document_view_dto_1 = require("./dto/student-document-view.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let StudentDocumentsController = class StudentDocumentsController {
    constructor(studentDocumentsService) {
        this.studentDocumentsService = studentDocumentsService;
    }
    async create(studentId, dto, user) {
        const document = await this.studentDocumentsService.create(studentId, dto, user.schoolId, user.id);
        return (0, student_document_view_dto_1.toStudentDocumentView)(document);
    }
    async findByStudent(studentId, schoolId) {
        const documents = await this.studentDocumentsService.findByStudent(studentId, schoolId);
        return documents.map(student_document_view_dto_1.toStudentDocumentView);
    }
};
exports.StudentDocumentsController = StudentDocumentsController;
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, roles_decorator_1.Roles)('school_admin', 'staff'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_student_document_dto_1.CreateStudentDocumentDto, Object]),
    __metadata("design:returntype", Promise)
], StudentDocumentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant', 'staff'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StudentDocumentsController.prototype, "findByStudent", null);
exports.StudentDocumentsController = StudentDocumentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('students'),
    __metadata("design:paramtypes", [student_documents_service_1.StudentDocumentsService])
], StudentDocumentsController);
let DocumentsController = class DocumentsController {
    constructor(studentDocumentsService) {
        this.studentDocumentsService = studentDocumentsService;
    }
    async remove(id, schoolId) {
        await this.studentDocumentsService.remove(id, schoolId);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('school_admin', 'staff'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "remove", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('documents'),
    __metadata("design:paramtypes", [student_documents_service_1.StudentDocumentsService])
], DocumentsController);
//# sourceMappingURL=student-documents.controller.js.map