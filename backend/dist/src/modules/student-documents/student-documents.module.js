"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentDocumentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const student_document_entity_1 = require("./entities/student-document.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const student_documents_controller_1 = require("./student-documents.controller");
const student_documents_service_1 = require("./student-documents.service");
let StudentDocumentsModule = class StudentDocumentsModule {
};
exports.StudentDocumentsModule = StudentDocumentsModule;
exports.StudentDocumentsModule = StudentDocumentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([student_document_entity_1.StudentDocument, student_entity_1.Student, parent_student_entity_1.ParentStudent])],
        controllers: [student_documents_controller_1.StudentDocumentsController, student_documents_controller_1.DocumentsController],
        providers: [student_documents_service_1.StudentDocumentsService],
        exports: [student_documents_service_1.StudentDocumentsService],
    })
], StudentDocumentsModule);
//# sourceMappingURL=student-documents.module.js.map