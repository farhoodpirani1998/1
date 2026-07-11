"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReportCard = buildReportCard;
const assessment_entity_1 = require("../entities/assessment.entity");
const NORMALIZED_SCALE = 20;
const ROUND_DECIMALS = 2;
function round(value) {
    const factor = 10 ** ROUND_DECIMALS;
    return Math.round(value * factor) / factor;
}
function normalizedScore(assessment) {
    const maxScore = Number(assessment.maxScore) || NORMALIZED_SCALE;
    return (Number(assessment.score) / maxScore) * NORMALIZED_SCALE;
}
function buildReportCard(studentId, assessments) {
    const academicYearId = assessments[0]?.academicYearId ?? null;
    const termOrder = [assessment_entity_1.AssessmentTerm.FIRST_TERM, assessment_entity_1.AssessmentTerm.SECOND_TERM];
    const byTerm = new Map();
    for (const assessment of assessments) {
        const list = byTerm.get(assessment.term) ?? [];
        list.push(assessment);
        byTerm.set(assessment.term, list);
    }
    const terms = termOrder
        .filter((term) => byTerm.has(term))
        .map((term) => {
        const records = byTerm.get(term);
        const average = records.length > 0
            ? round(records.reduce((sum, a) => sum + normalizedScore(a), 0) / records.length)
            : null;
        return {
            term,
            subjects: records.map((a) => ({
                subjectId: a.subjectId,
                subjectTitle: a.subject?.title,
                score: Number(a.score),
                maxScore: Number(a.maxScore),
            })),
            average,
        };
    });
    const termAverages = terms.map((t) => t.average).filter((a) => a !== null);
    const overallAverage = termAverages.length > 0
        ? round(termAverages.reduce((sum, a) => sum + a, 0) / termAverages.length)
        : null;
    return { studentId, academicYearId, terms, overallAverage };
}
//# sourceMappingURL=report-card-view.dto.js.map