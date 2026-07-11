"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStudentProfileView = buildStudentProfileView;
const report_card_view_dto_1 = require("../../student-assessments/dto/report-card-view.dto");
const RECENT_PAYMENTS_LIMIT = 5;
const RECENT_ATTENDANCE_LIMIT = 10;
const RECENT_ASSESSMENTS_LIMIT = 10;
const RECENT_DOCUMENTS_LIMIT = 10;
const RECENT_HOMEWORK_LIMIT = 10;
function buildStudentProfileView(params) {
    const { student, statement, parentUsers, attendanceRecords, assessmentRecords, documentRecords, homeworkRecords, } = params;
    const parents = [];
    if (student.guardian) {
        parents.push({
            id: student.guardian.id,
            fullName: student.guardian.fullName,
            phone: student.guardian.phone,
            type: 'guardian',
        });
    }
    for (const user of parentUsers) {
        parents.push({
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            type: 'parent_account',
        });
    }
    const tuitionSummary = {
        totalDue: statement.totals.totalDue,
        totalPaid: statement.totals.totalPaid,
        totalRemaining: statement.totals.totalRemaining,
        plans: statement.tuitionPlans.map((plan) => ({
            id: plan.id,
            academicYearId: plan.academicYearId,
            baseAmount: plan.baseAmount,
            discountAmount: plan.discountAmount,
            finalAmount: plan.finalAmount,
            installmentCount: plan.installments.length,
        })),
    };
    const allPayments = statement.tuitionPlans
        .flatMap((plan) => plan.installments)
        .flatMap((installment) => installment.payments)
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    const paymentSummary = {
        totalPayments: allPayments.length,
        totalAmountPaid: statement.totals.totalPaid,
        lastPaymentAt: allPayments[0]?.paidAt ?? null,
        recentPayments: allPayments.slice(0, RECENT_PAYMENTS_LIMIT).map((p) => ({
            id: p.id,
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            paidAt: p.paidAt,
        })),
    };
    return {
        student: {
            id: student.id,
            fullName: student.fullName,
            nationalId: student.nationalId,
            status: student.status,
            enrollmentDate: student.enrollmentDate,
        },
        school: { id: student.school.id, name: student.school.name },
        grade: { id: student.grade.id, title: student.grade.title },
        academicYear: {
            id: student.academicYear.id,
            title: student.academicYear.title,
            isCurrent: student.academicYear.isCurrent,
        },
        parents,
        tuitionSummary,
        paymentSummary,
        attendance: {
            available: true,
            records: attendanceRecords.slice(0, RECENT_ATTENDANCE_LIMIT).map((a) => ({
                id: a.id,
                date: a.date,
                status: a.status,
                note: a.note,
            })),
        },
        assessments: {
            available: true,
            records: assessmentRecords.slice(0, RECENT_ASSESSMENTS_LIMIT).map((a) => ({
                id: a.id,
                subjectId: a.subjectId,
                subjectTitle: a.subject?.title,
                term: a.term,
                score: Number(a.score),
                maxScore: Number(a.maxScore),
                note: a.note,
            })),
            reportSummary: (0, report_card_view_dto_1.buildReportCard)(student.id, assessmentRecords),
        },
        documents: {
            available: true,
            records: documentRecords.slice(0, RECENT_DOCUMENTS_LIMIT).map((d) => ({
                id: d.id,
                title: d.title,
                documentType: d.documentType,
                fileUrl: d.fileUrl,
                description: d.description,
                createdAt: d.createdAt,
            })),
        },
        homework: {
            available: true,
            records: homeworkRecords.slice(0, RECENT_HOMEWORK_LIMIT).map((h) => ({
                id: h.id,
                subjectId: h.subjectId,
                subjectTitle: h.subject?.title,
                title: h.title,
                description: h.description,
                dueDate: h.dueDate,
                attachmentUrl: h.attachmentUrl,
                createdAt: h.createdAt,
            })),
        },
        announcements: { available: false, records: [] },
    };
}
//# sourceMappingURL=student-profile-view.dto.js.map