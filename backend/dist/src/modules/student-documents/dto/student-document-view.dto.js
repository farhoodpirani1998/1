"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStudentDocumentView = toStudentDocumentView;
exports.toParentStudentDocumentView = toParentStudentDocumentView;
function toStudentDocumentView(document) {
    return {
        id: document.id,
        studentId: document.studentId,
        title: document.title,
        documentType: document.documentType,
        fileUrl: document.fileUrl,
        description: document.description,
        uploadedById: document.uploadedById,
        createdAt: document.createdAt,
    };
}
function toParentStudentDocumentView(document) {
    return {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        fileUrl: document.fileUrl,
        description: document.description,
        createdAt: document.createdAt,
    };
}
//# sourceMappingURL=student-document-view.dto.js.map