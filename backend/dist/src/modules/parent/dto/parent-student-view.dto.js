"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toParentStudentView = toParentStudentView;
function toParentStudentView(student) {
    return {
        id: student.id,
        fullName: student.fullName,
        status: student.status,
        enrollmentDate: student.enrollmentDate,
        school: { id: student.school.id, name: student.school.name },
        grade: { id: student.grade.id, title: student.grade.title },
        academicYear: {
            id: student.academicYear.id,
            title: student.academicYear.title,
            isCurrent: student.academicYear.isCurrent,
        },
    };
}
//# sourceMappingURL=parent-student-view.dto.js.map