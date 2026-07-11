"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_entity_1 = require("../students/entities/student.entity");
const attendance_entity_1 = require("../attendance/entities/attendance.entity");
const assessment_entity_1 = require("../student-assessments/entities/assessment.entity");
const payment_entity_1 = require("../tuition/entities/payment.entity");
const installment_entity_1 = require("../tuition/entities/installment.entity");
const tuition_plan_entity_1 = require("../tuition/entities/tuition-plan.entity");
const reports_service_1 = require("../reports/reports.service");
const attendance_service_1 = require("../attendance/attendance.service");
const announcements_service_1 = require("../announcements/announcements.service");
const report_card_view_dto_1 = require("../student-assessments/dto/report-card-view.dto");
const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_TREND_DAYS = 7;
const DEFAULT_MONTHS_BACK = 6;
const TOP_STUDENTS_LIMIT = 5;
const ROUND_DECIMALS = 2;
function round(value) {
    const factor = 10 ** ROUND_DECIMALS;
    return Math.round(value * factor) / factor;
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function lastNMonths(n, now = new Date()) {
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
    return months;
}
function lastNDates(n, now = new Date()) {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        dates.push(formatDate(d));
    }
    return dates;
}
let AnalyticsService = class AnalyticsService {
    constructor(studentRepo, attendanceRepo, assessmentRepo, paymentRepo, installmentRepo, tuitionPlanRepo, reportsService, attendanceService, announcementsService) {
        this.studentRepo = studentRepo;
        this.attendanceRepo = attendanceRepo;
        this.assessmentRepo = assessmentRepo;
        this.paymentRepo = paymentRepo;
        this.installmentRepo = installmentRepo;
        this.tuitionPlanRepo = tuitionPlanRepo;
        this.reportsService = reportsService;
        this.attendanceService = attendanceService;
        this.announcementsService = announcementsService;
    }
    async getDashboard(schoolId, query) {
        const recentLimit = query.recentLimit ?? DEFAULT_RECENT_LIMIT;
        const trendDays = query.trendDays ?? DEFAULT_TREND_DAYS;
        const monthsBack = query.monthsBack ?? DEFAULT_MONTHS_BACK;
        const [students, finance, attendance, assessments, recentActivity, charts] = await Promise.all([
            this.getStudentsSummary(schoolId),
            this.getFinanceSummary(schoolId),
            this.getAttendanceSummary(schoolId),
            this.getAssessmentsSummary(schoolId),
            this.getRecentActivity(schoolId, recentLimit),
            this.getCharts(schoolId, monthsBack, trendDays),
        ]);
        return { students, finance, attendance, assessments, recentActivity, charts, generatedAt: new Date() };
    }
    async getStudentsSummary(schoolId) {
        const [total, active] = await Promise.all([
            this.studentRepo.count({ where: { schoolId } }),
            this.studentRepo.count({ where: { schoolId, status: student_entity_1.StudentStatus.ACTIVE } }),
        ]);
        return { total, active };
    }
    async getFinanceSummary(schoolId) {
        const [tuitionRaw, paidRaw, overdue] = await Promise.all([
            this.tuitionPlanRepo
                .createQueryBuilder('plan')
                .innerJoin('plan.student', 'student')
                .where('student.schoolId = :schoolId', { schoolId })
                .select('COALESCE(SUM(plan.finalAmount), 0)', 'totalTuition')
                .getRawOne(),
            this.installmentRepo
                .createQueryBuilder('installment')
                .innerJoin('installment.tuitionPlan', 'plan')
                .innerJoin('plan.student', 'student')
                .where('student.schoolId = :schoolId', { schoolId })
                .select('COALESCE(SUM(installment.paidAmount), 0)', 'totalPaid')
                .getRawOne(),
            this.reportsService.overdueSummary(schoolId),
        ]);
        const totalTuition = Number(tuitionRaw?.totalTuition ?? 0);
        const totalPaid = Number(paidRaw?.totalPaid ?? 0);
        return {
            totalTuition,
            totalPaid,
            totalUnpaid: totalTuition - totalPaid,
            overdueAmount: overdue.totalOverdueAmount,
        };
    }
    async getAttendanceSummary(schoolId) {
        const today = formatDate(new Date());
        const [todayRecords, totalCount, presentCount] = await Promise.all([
            this.attendanceService.findByDate(today, schoolId, {}),
            this.attendanceRepo.count({ where: { schoolId } }),
            this.attendanceRepo.count({ where: { schoolId, status: attendance_entity_1.AttendanceStatus.PRESENT } }),
        ]);
        const presentToday = todayRecords.filter((r) => r.status === attendance_entity_1.AttendanceStatus.PRESENT).length;
        const absentToday = todayRecords.filter((r) => r.status === attendance_entity_1.AttendanceStatus.ABSENT).length;
        const lateToday = todayRecords.filter((r) => r.status === attendance_entity_1.AttendanceStatus.LATE).length;
        return {
            attendanceRate: totalCount > 0 ? round((presentCount / totalCount) * 100) : 0,
            presentToday,
            absentToday,
            lateToday,
        };
    }
    async getAssessmentsSummary(schoolId) {
        const assessments = await this.assessmentRepo.find({
            where: { schoolId },
            relations: ['student', 'subject'],
        });
        if (assessments.length === 0) {
            return { averageScore: null, topStudents: [], lowestStudents: [] };
        }
        const byStudent = new Map();
        for (const assessment of assessments) {
            const list = byStudent.get(assessment.studentId) ?? [];
            list.push(assessment);
            byStudent.set(assessment.studentId, list);
        }
        const studentAverages = [];
        for (const [studentId, list] of byStudent) {
            const reportCard = (0, report_card_view_dto_1.buildReportCard)(studentId, list);
            if (reportCard.overallAverage !== null) {
                studentAverages.push({
                    studentId,
                    studentFullName: list[0].student?.fullName ?? '',
                    average: reportCard.overallAverage,
                });
            }
        }
        const averageScore = studentAverages.length > 0
            ? round(studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length)
            : null;
        const sortedDesc = [...studentAverages].sort((a, b) => b.average - a.average);
        const topStudents = sortedDesc.slice(0, TOP_STUDENTS_LIMIT);
        const lowestStudents = [...sortedDesc].reverse().slice(0, TOP_STUDENTS_LIMIT);
        return { averageScore, topStudents, lowestStudents };
    }
    async getRecentActivity(schoolId, limit) {
        const [payments, attendance, assessments, announcements] = await Promise.all([
            this.getRecentPayments(schoolId, limit),
            this.getRecentAttendance(schoolId, limit),
            this.getRecentAssessments(schoolId, limit),
            this.getRecentAnnouncements(schoolId, limit),
        ]);
        return { payments, attendance, assessments, announcements };
    }
    async getRecentPayments(schoolId, limit) {
        const raw = await this.paymentRepo
            .createQueryBuilder('payment')
            .innerJoin('payment.installment', 'installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .where('student.schoolId = :schoolId', { schoolId })
            .select('payment.id', 'id')
            .addSelect('payment.amount', 'amount')
            .addSelect('payment.paymentMethod', 'paymentMethod')
            .addSelect('payment.paidAt', 'paidAt')
            .addSelect('student.id', 'studentId')
            .addSelect('student.fullName', 'studentFullName')
            .orderBy('payment.paidAt', 'DESC')
            .limit(limit)
            .getRawMany();
        return raw.map((r) => ({
            id: r.id,
            studentId: r.studentId,
            studentFullName: r.studentFullName,
            amount: Number(r.amount),
            paymentMethod: r.paymentMethod,
            paidAt: r.paidAt,
        }));
    }
    async getRecentAttendance(schoolId, limit) {
        const rows = await this.attendanceRepo.find({
            where: { schoolId },
            relations: ['student'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return rows.map((a) => ({
            id: a.id,
            studentId: a.studentId,
            studentFullName: a.student?.fullName ?? '',
            date: a.date,
            status: a.status,
        }));
    }
    async getRecentAssessments(schoolId, limit) {
        const rows = await this.assessmentRepo.find({
            where: { schoolId },
            relations: ['student', 'subject'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return rows.map((a) => ({
            id: a.id,
            studentId: a.studentId,
            studentFullName: a.student?.fullName ?? '',
            subjectTitle: a.subject?.title,
            term: a.term,
            score: Number(a.score),
            maxScore: Number(a.maxScore),
        }));
    }
    async getRecentAnnouncements(schoolId, limit) {
        const rows = await this.announcementsService.findAllForSchool(schoolId);
        return rows.slice(0, limit).map((a) => ({
            id: a.id,
            title: a.title,
            targetType: a.targetType,
            createdAt: a.createdAt,
        }));
    }
    async getCharts(schoolId, monthsBack, trendDays) {
        const [monthlyPayments, monthlyRegistrations, attendanceTrend, paymentStatusDistribution] = await Promise.all([
            this.getMonthlyPayments(schoolId, monthsBack),
            this.getMonthlyRegistrations(schoolId, monthsBack),
            this.getAttendanceTrend(schoolId, trendDays),
            this.getPaymentStatusDistribution(schoolId),
        ]);
        return { monthlyPayments, monthlyRegistrations, attendanceTrend, paymentStatusDistribution };
    }
    async getMonthlyPayments(schoolId, monthsBack) {
        const months = lastNMonths(monthsBack);
        return Promise.all(months.map(({ year, month }) => this.reportsService.monthlyIncome(schoolId, year, month)));
    }
    async getMonthlyRegistrations(schoolId, monthsBack) {
        const months = lastNMonths(monthsBack);
        const start = new Date(Date.UTC(months[0].year, months[0].month - 1, 1));
        const raw = await this.studentRepo
            .createQueryBuilder('student')
            .where('student.schoolId = :schoolId', { schoolId })
            .andWhere('student.createdAt >= :start', { start })
            .select("to_char(student.createdAt, 'YYYY-MM')", 'yearMonth')
            .addSelect('COUNT(*)', 'count')
            .groupBy("to_char(student.createdAt, 'YYYY-MM')")
            .getRawMany();
        const countByMonth = new Map(raw.map((r) => [r.yearMonth, Number(r.count)]));
        return months.map(({ year, month }) => ({
            year,
            month,
            count: countByMonth.get(`${year}-${String(month).padStart(2, '0')}`) ?? 0,
        }));
    }
    async getAttendanceTrend(schoolId, trendDays) {
        const dates = lastNDates(trendDays);
        return Promise.all(dates.map(async (date) => {
            const records = await this.attendanceService.findByDate(date, schoolId, {});
            const totalCount = records.length;
            const presentCount = records.filter((r) => r.status === attendance_entity_1.AttendanceStatus.PRESENT).length;
            return {
                date,
                presentCount,
                totalCount,
                rate: totalCount > 0 ? round((presentCount / totalCount) * 100) : 0,
            };
        }));
    }
    async getPaymentStatusDistribution(schoolId) {
        const raw = await this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .where('student.schoolId = :schoolId', { schoolId })
            .select('installment.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(installment.amount - installment.paidAmount), 0)', 'outstandingAmount')
            .groupBy('installment.status')
            .getRawMany();
        return raw.map((r) => ({
            status: r.status,
            count: Number(r.count),
            outstandingAmount: Number(r.outstandingAmount),
        }));
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(1, (0, typeorm_1.InjectRepository)(attendance_entity_1.Attendance)),
    __param(2, (0, typeorm_1.InjectRepository)(assessment_entity_1.Assessment)),
    __param(3, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(4, (0, typeorm_1.InjectRepository)(installment_entity_1.Installment)),
    __param(5, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        reports_service_1.ReportsService,
        attendance_service_1.AttendanceService,
        announcements_service_1.AnnouncementsService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map