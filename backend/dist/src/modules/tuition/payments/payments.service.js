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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const payment_entity_1 = require("../entities/payment.entity");
const installment_entity_1 = require("../entities/installment.entity");
const ledger_service_1 = require("../../ledger/ledger.service");
const installment_state_machine_1 = require("../state-machine/installment-state-machine");
const jalali_1 = require("../../../common/utils/jalali");
const pagination_1 = require("../../../common/utils/pagination");
const domain_events_1 = require("../../../common/events/domain-events");
const PG_UNIQUE_VIOLATION = '23505';
let PaymentsService = class PaymentsService {
    constructor(paymentRepo, dataSource, ledger, events) {
        this.paymentRepo = paymentRepo;
        this.dataSource = dataSource;
        this.ledger = ledger;
        this.events = events;
    }
    async create(installmentId, dto, receivedById, schoolId) {
        let result;
        try {
            result = await this.dataSource.transaction(async (manager) => {
                if (dto.idempotencyKey) {
                    const existing = await manager.findOne(payment_entity_1.Payment, {
                        where: { idempotencyKey: dto.idempotencyKey },
                    });
                    if (existing) {
                        if (!this.isSameLogicalPayment(existing, installmentId, dto)) {
                            throw new common_1.ConflictException('این کد یکتا قبلاً برای پرداختی با اطلاعات متفاوت استفاده شده است');
                        }
                        const installment = await manager.findOne(installment_entity_1.Installment, {
                            where: { id: existing.installmentId },
                        });
                        return {
                            payment: existing,
                            installment: installment,
                            idempotentReplay: true,
                            statusChangeEvent: null,
                        };
                    }
                }
                const installment = await manager.findOne(installment_entity_1.Installment, {
                    where: { id: installmentId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!installment) {
                    throw new common_1.NotFoundException('قسط یافت نشد');
                }
                if (!installment_state_machine_1.InstallmentStateMachine.isLiveState(installment.status)) {
                    throw new common_1.BadRequestException(`نمی‌توان برای قسطی با وضعیت «${installment.status}» پرداخت ثبت کرد`);
                }
                const ownership = await manager
                    .createQueryBuilder()
                    .select('student.school_id', 'schoolId')
                    .addSelect('student.id', 'studentId')
                    .addSelect('plan.id', 'tuitionPlanId')
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
                    idempotencyKey: dto.idempotencyKey ?? null,
                });
                const savedPayment = await manager.save(payment);
                const jalaliYear = (0, jalali_1.gregorianToJalaliYear)(new Date(dto.paidAt));
                const counterRows = await manager.query(`INSERT INTO receipt_counters (school_id, jalali_year, last_number)
           VALUES ($1, $2, 1)
           ON CONFLICT (school_id, jalali_year)
           DO UPDATE SET last_number = receipt_counters.last_number + 1
           RETURNING last_number`, [schoolId, jalaliYear]);
                savedPayment.receiptNumber = `${jalaliYear}-${String(counterRows[0].last_number).padStart(6, '0')}`;
                await manager.save(savedPayment);
                await this.ledger.recordPayment(manager, {
                    schoolId,
                    studentId: ownership.studentId,
                    tuitionPlanId: ownership.tuitionPlanId,
                    paymentId: savedPayment.id,
                    amount: dto.amount,
                    performedBy: receivedById,
                });
                const { installment: updatedInstallment, statusChangeEvent } = await this.applyStateMachine(manager, installment, schoolId, ownership.studentId, receivedById);
                return {
                    payment: savedPayment,
                    installment: updatedInstallment,
                    idempotentReplay: false,
                    statusChangeEvent,
                };
            });
        }
        catch (err) {
            if (dto.idempotencyKey && this.isUniqueViolation(err, 'uq_payments_idempotency_key')) {
                const existing = await this.paymentRepo.findOne({
                    where: { idempotencyKey: dto.idempotencyKey },
                });
                if (existing) {
                    if (!this.isSameLogicalPayment(existing, installmentId, dto)) {
                        throw new common_1.ConflictException('این کد یکتا قبلاً برای پرداختی با اطلاعات متفاوت استفاده شده است');
                    }
                    const installment = await this.dataSource
                        .getRepository(installment_entity_1.Installment)
                        .findOne({ where: { id: existing.installmentId } });
                    return { payment: existing, installment: installment, idempotentReplay: true };
                }
            }
            throw err;
        }
        if (!result.idempotentReplay) {
            const remaining = Number(result.installment.amount) - Number(result.installment.paidAmount);
            this.events.emit(domain_events_1.DOMAIN_EVENTS.PAYMENT_RECORDED, new domain_events_1.PaymentRecordedEvent(schoolId, result.installment.id, result.payment.installmentId, result.payment.id, Number(result.payment.amount), remaining, receivedById, false));
            if (result.statusChangeEvent) {
                this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, result.statusChangeEvent);
            }
        }
        return {
            payment: result.payment,
            installment: result.installment,
            idempotentReplay: result.idempotentReplay,
        };
    }
    isUniqueViolation(err, constraint) {
        return (err instanceof typeorm_2.QueryFailedError &&
            err.driverError
                ?.code === PG_UNIQUE_VIOLATION &&
            err.driverError?.constraint ===
                constraint);
    }
    isSameLogicalPayment(existing, installmentId, dto) {
        return (existing.installmentId === installmentId &&
            Number(existing.amount) === Number(dto.amount) &&
            existing.paymentMethod === dto.paymentMethod &&
            (existing.referenceNumber ?? null) === (dto.referenceNumber ?? null) &&
            new Date(existing.paidAt).getTime() === new Date(dto.paidAt).getTime());
    }
    async applyStateMachine(manager, installmentBeforeTrigger, schoolId, studentId, performedBy) {
        const fresh = await manager.findOne(installment_entity_1.Installment, {
            where: { id: installmentBeforeTrigger.id },
        });
        if (!fresh)
            throw new common_1.NotFoundException('قسط یافت نشد');
        if (!installment_state_machine_1.InstallmentStateMachine.isLiveState(fresh.status)) {
            return { installment: fresh, statusChangeEvent: null };
        }
        const naturalStatus = installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(Number(fresh.paidAmount), Number(fresh.amount), fresh.dueDate);
        if (naturalStatus !== fresh.status) {
            installment_state_machine_1.InstallmentStateMachine.assertTransition(fresh.status, naturalStatus);
            const previous = fresh.status;
            fresh.status = naturalStatus;
            await manager.save(fresh);
            return {
                installment: fresh,
                statusChangeEvent: new domain_events_1.InstallmentStatusChangedEvent(schoolId, studentId, fresh.id, previous, naturalStatus, performedBy),
            };
        }
        return { installment: fresh, statusChangeEvent: null };
    }
    async findAll(schoolId, studentId, pagination = {}) {
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
        const { limit, skip } = (0, pagination_1.normalizePagination)(pagination);
        return qb.skip(skip).take(limit).getMany();
    }
    async getReceipt(id, schoolId) {
        const raw = await this.paymentRepo
            .createQueryBuilder('payment')
            .innerJoin('payment.installment', 'installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .innerJoin('student.school', 'school')
            .leftJoin('payment.receivedBy', 'receivedBy')
            .select('payment.receiptNumber', 'receiptNumber')
            .addSelect('payment.amount', 'amount')
            .addSelect('payment.paymentMethod', 'paymentMethod')
            .addSelect('payment.paidAt', 'paidAt')
            .addSelect('school.name', 'schoolName')
            .addSelect('school.address', 'schoolAddress')
            .addSelect('school.phone', 'schoolPhone')
            .addSelect('student.id', 'studentId')
            .addSelect('student.fullName', 'studentFullName')
            .addSelect('receivedBy.id', 'receivedById')
            .addSelect('receivedBy.fullName', 'receivedByFullName')
            .where('payment.id = :id', { id })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .getRawOne();
        if (!raw) {
            throw new common_1.NotFoundException('پرداخت یافت نشد یا متعلق به مدرسه‌ی دیگری است');
        }
        return {
            receiptNumber: raw.receiptNumber,
            amount: Number(raw.amount),
            paymentMethod: raw.paymentMethod,
            paidAt: raw.paidAt,
            school: { name: raw.schoolName, address: raw.schoolAddress, phone: raw.schoolPhone },
            student: { id: raw.studentId, fullName: raw.studentFullName },
            receivedBy: raw.receivedById
                ? { id: raw.receivedById, fullName: raw.receivedByFullName }
                : null,
        };
    }
    async void(id, reason, voidedById, schoolId) {
        const { voidedEvent, statusChangeEvent } = await this.dataSource.transaction(async (manager) => {
            const payment = await manager
                .createQueryBuilder(payment_entity_1.Payment, 'payment')
                .innerJoin('payment.installment', 'installment')
                .innerJoin('installment.tuitionPlan', 'plan')
                .innerJoin('plan.student', 'student')
                .where('payment.id = :id', { id })
                .andWhere('student.schoolId = :schoolId', { schoolId })
                .andWhere('payment.deletedAt IS NULL')
                .getOne();
            if (!payment) {
                throw new common_1.NotFoundException('پرداخت یافت نشد، قبلاً باطل شده، یا متعلق به مدرسه‌ی دیگری است');
            }
            const installment = await manager.findOne(installment_entity_1.Installment, {
                where: { id: payment.installmentId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!installment) {
                throw new common_1.NotFoundException('قسط یافت نشد');
            }
            payment.voidedById = voidedById;
            payment.voidReason = reason;
            await manager.save(payment);
            await manager.softDelete(payment_entity_1.Payment, id);
            const ownership = await manager
                .createQueryBuilder()
                .select('student.id', 'studentId')
                .addSelect('plan.id', 'tuitionPlanId')
                .from('students', 'student')
                .innerJoin('tuition_plans', 'plan', 'plan.student_id = student.id')
                .where('plan.id = :planId', { planId: installment.tuitionPlanId })
                .getRawOne();
            await this.ledger.recordVoid(manager, {
                schoolId,
                studentId: ownership.studentId,
                tuitionPlanId: ownership.tuitionPlanId,
                paymentId: payment.id,
                amount: Number(payment.amount),
                reason,
                performedBy: voidedById,
            });
            const { statusChangeEvent } = await this.applyStateMachine(manager, installment, schoolId, ownership.studentId, voidedById);
            return {
                voidedEvent: new domain_events_1.PaymentVoidedEvent(schoolId, ownership.studentId, payment.installmentId, payment.id, Number(payment.amount), reason, voidedById),
                statusChangeEvent,
            };
        });
        this.events.emit(domain_events_1.DOMAIN_EVENTS.PAYMENT_VOIDED, voidedEvent);
        if (statusChangeEvent) {
            this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, statusChangeEvent);
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        ledger_service_1.LedgerService,
        event_emitter_1.EventEmitter2])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map