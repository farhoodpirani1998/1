"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStudentSearchResult = toStudentSearchResult;
exports.toParentSearchResult = toParentSearchResult;
exports.toTeacherSearchResult = toTeacherSearchResult;
exports.toSubjectSearchResult = toSubjectSearchResult;
exports.toHomeworkSearchResult = toHomeworkSearchResult;
exports.toAnnouncementSearchResult = toAnnouncementSearchResult;
function toStudentSearchResult(student) {
    return {
        id: student.id,
        fullName: student.fullName,
        nationalId: student.nationalId,
        status: student.status,
    };
}
function toParentSearchResult(guardian) {
    return {
        id: guardian.id,
        fullName: guardian.fullName,
        phone: guardian.phone,
    };
}
function toTeacherSearchResult(teacher) {
    return {
        id: teacher.id,
        fullName: teacher.fullName,
        phone: teacher.phone,
    };
}
function toSubjectSearchResult(subject) {
    return {
        id: subject.id,
        title: subject.title,
    };
}
function toHomeworkSearchResult(homework) {
    return {
        id: homework.id,
        title: homework.title,
        dueDate: homework.dueDate,
    };
}
function toAnnouncementSearchResult(announcement) {
    return {
        id: announcement.id,
        title: announcement.title,
        targetType: announcement.targetType,
        createdAt: announcement.createdAt,
    };
}
//# sourceMappingURL=search-result-view.dto.js.map