import { Assessment, AssessmentTerm } from '../entities/assessment.entity';

// Normalization scale for averages: every subject's score is rescaled to
// "out of 20" (score / maxScore * 20) before averaging, so a report card
// that mixes a subject scored out of 20 with, say, a project scored out
// of 100 still produces a meaningful average instead of one that's
// dominated by whichever subject happened to use the larger scale.
const NORMALIZED_SCALE = 20;
const ROUND_DECIMALS = 2;

function round(value: number): number {
  const factor = 10 ** ROUND_DECIMALS;
  return Math.round(value * factor) / factor;
}

function normalizedScore(assessment: Assessment): number {
  const maxScore = Number(assessment.maxScore) || NORMALIZED_SCALE;
  return (Number(assessment.score) / maxScore) * NORMALIZED_SCALE;
}

export interface ReportCardSubjectEntry {
  subjectId: string;
  subjectTitle?: string;
  score: number;
  maxScore: number;
}

export interface ReportCardTermSummary {
  term: AssessmentTerm;
  subjects: ReportCardSubjectEntry[];
  // Average of this term's subjects, normalized to a 0–20 scale (see
  // NORMALIZED_SCALE above).
  average: number | null;
}

export interface ReportCardView {
  studentId: string;
  academicYearId: string | null;
  terms: ReportCardTermSummary[];
  // Average across every term with at least one recorded assessment,
  // normalized to a 0–20 scale. `null` (not 0) when there is nothing to
  // average yet, so the frontend can distinguish "no assessments" from
  // "a real average of zero".
  overallAverage: number | null;
}

/**
 * Pure function (no DI, no I/O) so every caller -- staff
 * (AssessmentsService.getReportCard), parent
 * (AssessmentsService.getReportCardForParent), and the student-profile
 * report summary -- builds the exact same shape from the exact same
 * input, one place to change the response contract. Same reasoning as
 * buildStudentProfileView in students/profile/student-profile-view.dto.ts.
 */
export function buildReportCard(
  studentId: string,
  assessments: Assessment[],
): ReportCardView {
  const academicYearId = assessments[0]?.academicYearId ?? null;

  const termOrder = [AssessmentTerm.FIRST_TERM, AssessmentTerm.SECOND_TERM];
  const byTerm = new Map<AssessmentTerm, Assessment[]>();
  for (const assessment of assessments) {
    const list = byTerm.get(assessment.term as AssessmentTerm) ?? [];
    list.push(assessment);
    byTerm.set(assessment.term as AssessmentTerm, list);
  }

  const terms: ReportCardTermSummary[] = termOrder
    .filter((term) => byTerm.has(term))
    .map((term) => {
      const records = byTerm.get(term)!;
      const average =
        records.length > 0
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

  const termAverages = terms.map((t) => t.average).filter((a): a is number => a !== null);
  const overallAverage =
    termAverages.length > 0
      ? round(termAverages.reduce((sum, a) => sum + a, 0) / termAverages.length)
      : null;

  return { studentId, academicYearId, terms, overallAverage };
}
