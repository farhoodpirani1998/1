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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const payment_entity_1 = require("../entities/payment.entity");
const installment_entity_1 = require("../entities/installment.entity");
const notifications_service_1 = require("../../notifications/notifications.service");
let PaymentsService = class PaymentsService {
    constructor(paymentRepo, dataSource, notificationsService) {
        this.paymentRepo = paymentRepo;
        this.dataSource = dataSource;
        this.notificationsService = notificationsService;
    }
    async create(installmentId, dto, receivedById, schoolId) {
        const result = await this.dataSource.transaction(async (manager) => {
            const installment = await manager.findOne(installment_entity_1.Installment, {
                where: { id: installmentId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!installment) {
                throw new common_1.NotFoundException('قسط یافت نشد');
            }
            const ownership = await manager
                .createQueryBuilder()
                .select('student.school_id', 'schoolId')
                .addSelect('student.id', 'studentId')
                .from('students', 'student')
                .innerJoin('tuition_plans', 'plan', 'plan.student_id = student.id')
                .where('plan.id = :planId', { planId: installment.tuitionPlanId })
                .getRawOne();
            if (!ownership || ownership.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این قسط متعلق به مدرسه‌ی دیگری است');
            }
            const remaining = Number(installment.amount) - Number(installment.paidAmount);
            if (dto.amount > remaining) {
                throw new common_1.BadRequestException(`مبلغ پرداختی از باقیمانده قسط (${remaining.toLocaleString('fa-IR')} تومان) بیشتر است`);
            }
            const payment = manager.create(payment_entity_1.Payment, {
                installmentId,
                amount: dto.amount,
                paymentMethod: dto.paymentMethod,
                referenceNumber: dto.referenceNumber ?? null,
                receivedById,
                paidAt: new Date(dto.paidAt),
                note: dto.note ?? null,
            });
            const savedPayment = await manager.save(payment);
            const updatedInstallment = await manager.findOne(installment_entity_1.Installment, {
                where: { id: installmentId },
            });
            return { payment: savedPayment, installment: updatedInstallment, studentId: ownership.studentId };
        });
        await this.notificationsService.queuePaymentConfirmation(installmentId, result.studentId, Number(result.payment.amount));
        return { payment: result.payment, installment: result.installment };
    }
    async findAll(schoolId, studentId) {
        const qb = this.paymentRepo
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.installment', 'installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .addSelect(['student.id', 'student.fullName'])
            .where('student.schoolId = :schoolId', { schoolId })
            .orderBy('payment.paidAt', 'DESC');
        if (studentId) {
            qb.andWhere('plan.studentId = :studentId', { studentId });
        }
        return qb.getMany();
    }
    async softDelete(id, schoolId) {
        const payment = await this.paymentRepo
            .createQueryBuilder('payment')
            .innerJoin('payment.installment', 'installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .where('payment.id = :id', { id })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .getOne();
        if (!payment) {
            throw new common_1.NotFoundException('پرداخت یافت نشد');
        }
        await this.paymentRepo.softDelete(id);
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.DataSource !== "undefined" && typeorm_2.DataSource) === "function" ? _b : Object, notifications_service_1.NotificationsService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map