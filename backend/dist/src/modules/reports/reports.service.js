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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const installment_entity_1 = require("../tuition/entities/installment.entity");
const tuition_plan_entity_1 = require("../tuition/entities/tuition-plan.entity");
const payment_entity_1 = require("../tuition/entities/payment.entity");
const student_entity_1 = require("../students/entities/student.entity");
const ledger_entry_entity_1 = require("../ledger/entities/ledger-entry.entity");
let ReportsService = class ReportsService {
    constructor(installmentRepo, tuitionPlanRepo, paymentRepo, studentRepo, ledgerRepo) {
        this.installmentRepo = installmentRepo;
        this.tuitionPlanRepo = tuitionPlanRepo;
        this.paymentRepo = paymentRepo;
        this.studentRepo = studentRepo;
        this.ledgerRepo = ledgerRepo;
    }
    async monthlyIncome(schoolId, year, month) {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        const raw = await this.ledgerRepo
            .createQueryBuilder('l')
            .where('l.schoolId = :schoolId', { schoolId })
            .andWhere('l.entryType = :type', { type: ledger_entry_entity_1.LedgerEntryType.PAYMENT })
            .andWhere('l.createdAt >= :start AND l.createdAt < :end', { start, end })
            .select('COALESCE(SUM(-l.amount), 0)', 'totalIncome')
            .addSelect('COUNT(*)', 'paymentCount')
            .getRawOne();
        return {
            year,
            month,
            totalIncome: Number(raw?.totalIncome ?? 0),
            paymentCount: Number(raw?.paymentCount ?? 0),
        };
    }
    async debtorStudents(schoolId, limit = 100) {
        const raw = await this.ledgerRepo
            .createQueryBuilder('l')
            .innerJoin('l.student', 'student')
            .where('l.schoolId = :schoolId', { schoolId })
            .select('l.studentId', 'studentId')
            .addSelect('student.fullName', 'studentFullName')
            .addSelect('SUM(l.amount)', 'outstandingBalance')
            .groupBy('l.studentId')
            .addGroupBy('student.fullName')
            .having('SUM(l.amount) > 0')
            .orderBy('SUM(l.amount)', 'DESC')
            .limit(limit)
            .getRawMany();
        return raw.map((r) => ({
            studentId: r.studentId,
            studentFullName: r.studentFullName,
            outstandingBalance: Number(r.outstandingBalance),
        }));
    }
    async overdueSummary(schoolId) {
        const raw = await this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .where('student.schoolId = :schoolId', { schoolId })
            .andWhere('installment.status = :status', {
            status: installment_entity_1.InstallmentStatus.OVERDUE,
        })
            .select('COUNT(DISTINCT installment.id)', 'overdueInstallmentCount')
            .addSelect('COUNT(DISTINCT student.id)', 'overdueStudentCount')
            .addSelect('COALESCE(SUM(installment.amount - installment.paidAmount), 0)', 'totalOverdueAmount')
            .getRawOne();
        return {
            overdueInstallmentCount: Number(raw?.overdueInstallmentCount ?? 0),
            overdueStudentCount: Number(raw?.overdueStudentCount ?? 0),
            totalOverdueAmount: Number(raw?.totalOverdueAmount ?? 0),
        };
    }
    async studentStatement(studentId, schoolId) {
        const student = await this.studentRepo.findOne({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        const plans = await this.tuitionPlanRepo.find({
            where: { studentId },
            relations: ['installments', 'installments.payments'],
            order: { createdAt: 'DESC' },
        });
        let totalDue = 0;
        let totalPaid = 0;
        const tuitionPlans = plans.map((plan) => {
            totalDue += Number(plan.finalAmount);
            const installments = (plan.installments ?? [])
                .sort((a, b) => a.installmentNumber - b.installmentNumber)
                .map((installment) => {
                totalPaid += Number(installment.paidAmount);
                return {
                    id: installment.id,
                    installmentNumber: installment.installmentNumber,
                    amount: Number(installment.amount),
                    paidAmount: Number(installment.paidAmount),
                    dueDate: installment.dueDate,
                    status: installment.status,
                    payments: (installment.payments ?? []).map((p) => ({
                        id: p.id,
                        amount: Number(p.amount),
                        paymentMethod: p.paymentMethod,
                        paidAt: p.paidAt,
                    })),
                };
            });
            return {
                id: plan.id,
                academicYearId: plan.academicYearId,
                baseAmount: Number(plan.baseAmount),
                discountAmount: Number(plan.discountAmount),
                finalAmount: Number(plan.finalAmount),
                installments,
            };
        });
        return {
            student: { id: student.id, fullName: student.fullName },
            tuitionPlans,
            totals: {
                totalDue,
                totalPaid,
                totalRemaining: totalDue - totalPaid,
            },
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(installment_entity_1.Installment)),
    __param(1, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __param(2, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(3, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(4, (0, typeorm_1.InjectRepository)(ledger_entry_entity_1.LedgerEntry)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map