"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAttendanceView = toAttendanceView;
exports.toParentAttendanceView = toParentAttendanceView;
function toAttendanceView(attendance) {
    return {
        id: attendance.id,
        studentId: attendance.studentId,
        studentName: attendance.student?.fullName,
        academicYearId: attendance.academicYearId,
        date: attendance.date,
        status: attendance.status,
        note: attendance.note,
        recordedById: attendance.recordedById,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
    };
}
function toParentAttendanceView(attendance) {
    return {
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        note: attendance.note,
    };
}
//# sourceMappingURL=attendance-view.dto.js.map