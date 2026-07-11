"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTimetableEntryView = toTimetableEntryView;
exports.toRecipientTimetableEntryView = toRecipientTimetableEntryView;
function toTimetableEntryView(entry) {
    return {
        id: entry.id,
        academicYearId: entry.academicYearId,
        gradeId: entry.gradeId,
        gradeTitle: entry.grade?.title,
        subjectId: entry.subjectId,
        subjectTitle: entry.subject?.title,
        teacherId: entry.teacherId,
        teacherName: entry.teacher?.fullName,
        weekday: entry.weekday,
        startTime: entry.startTime.slice(0, 5),
        endTime: entry.endTime.slice(0, 5),
        room: entry.room,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}
function toRecipientTimetableEntryView(entry) {
    return toTimetableEntryView(entry);
}
//# sourceMappingURL=timetable-entry-view.dto.js.map