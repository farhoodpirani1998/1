"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHomeworkView = toHomeworkView;
exports.toRecipientHomeworkView = toRecipientHomeworkView;
function toHomeworkView(homework) {
    return {
        id: homework.id,
        academicYearId: homework.academicYearId,
        gradeId: homework.gradeId,
        gradeTitle: homework.grade?.title,
        subjectId: homework.subjectId,
        subjectTitle: homework.subject?.title,
        teacherId: homework.teacherId,
        teacherName: homework.teacher?.fullName,
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        attachmentUrl: homework.attachmentUrl,
        createdAt: homework.createdAt,
        updatedAt: homework.updatedAt,
    };
}
function toRecipientHomeworkView(homework) {
    return toHomeworkView(homework);
}
//# sourceMappingURL=homework-view.dto.js.map