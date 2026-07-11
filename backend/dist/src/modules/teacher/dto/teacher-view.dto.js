"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTeacherProfileView = toTeacherProfileView;
exports.toTeacherAssignmentView = toTeacherAssignmentView;
function toTeacherProfileView(user, assignments) {
    return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        schoolId: user.schoolId,
        isActive: user.isActive,
        assignments: assignments.map((a) => ({
            id: a.id,
            gradeId: a.gradeId,
            gradeTitle: a.grade?.title,
            subjectId: a.subjectId,
            subjectTitle: a.subject?.title,
        })),
    };
}
function toTeacherAssignmentView(assignment) {
    return {
        id: assignment.id,
        teacherId: assignment.teacherId,
        gradeId: assignment.gradeId,
        subjectId: assignment.subjectId,
        createdAt: assignment.createdAt,
    };
}
//# sourceMappingURL=teacher-view.dto.js.map