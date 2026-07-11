"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAssessmentView = toAssessmentView;
exports.toParentAssessmentView = toParentAssessmentView;
function toAssessmentView(assessment) {
    return {
        id: assessment.id,
        studentId: assessment.studentId,
        subjectId: assessment.subjectId,
        subjectTitle: assessment.subject?.title,
        academicYearId: assessment.academicYearId,
        term: assessment.term,
        score: Number(assessment.score),
        maxScore: Number(assessment.maxScore),
        note: assessment.note,
        recordedById: assessment.recordedById,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
    };
}
function toParentAssessmentView(assessment) {
    return {
        id: assessment.id,
        subjectId: assessment.subjectId,
        subjectTitle: assessment.subject?.title,
        term: assessment.term,
        score: Number(assessment.score),
        maxScore: Number(assessment.maxScore),
        note: assessment.note,
    };
}
//# sourceMappingURL=assessment-view.dto.js.map