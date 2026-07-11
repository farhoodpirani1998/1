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
exports.InstallmentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const installment_entity_1 = require("../entities/installment.entity");
const tuition_plan_entity_1 = require("../entities/tuition-plan.entity");
const installment_state_machine_1 = require("../state-machine/installment-state-machine");
const domain_events_1 = require("../../../common/events/domain-events");
const pagination_1 = require("../../../common/utils/pagination");
let InstallmentsService = class InstallmentsService {
    constructor(installmentRepo, tuitionPlanRepo, dataSource, events) {
        this.installmentRepo = installmentRepo;
        this.tuitionPlanRepo = tuitionPlanRepo;
        this.dataSource = dataSource;
        this.events = events;
    }
    async generate(tuitionPlanId, dto, schoolId) {
        const plan = await this.tuitionPlanRepo.findOne({
            where: { id: tuitionPlanId },
            relations: ['installments', 'student'],
        });
        if (!plan) {
            throw new common_1.NotFoundException('برنامه شهریه یافت نشد');
        }
        if (plan.student.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
        }
        if (plan.installments?.length) {
            throw new common_1.BadRequestException('برای این برنامه شهریه قبلاً قسط ساخته شده است');
        }
        const baseShare = Math.floor(Number(plan.finalAmount) / dto.count);
        const remainder = Number(plan.finalAmount) - baseShare * dto.count;
        const installments = [];
        const start = new Date(dto.startDate);
        for (let i = 0; i < dto.count; i++) {
            const dueDate = new Date(start);
            dueDate.setDate(dueDate.getDate() + i * dto.intervalDays);
            const isLast = i === dto.count - 1;
            const amount = baseShare + (isLast ? remainder : 0);
            installments.push(this.installmentRepo.create({
                tuitionPlanId: plan.id,
                installmentNumber: i + 1,
                amount,
                dueDate: dueDate.toISOString().slice(0, 10),
                status: installment_entity_1.InstallmentStatus.PENDING,
                paidAmount: 0,
            }));
        }
        const saved = await this.installmentRepo.save(installments);
        this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENTS_GENERATED, new domain_events_1.InstallmentsGeneratedEvent(schoolId, plan.studentId, plan.id, saved.map((i) => i.id)));
        return saved;
    }
    async findWithFilters(query) {
        const qb = this.installmentRepo
            .createQueryBuilder('installment')
            .leftJoinAndSelect('installment.tuitionPlan', 'plan')
            .leftJoinAndSelect('plan.student', 'student');
        if (query.status) {
            qb.andWhere('installment.status = :status', { status: query.status });
        }
        if (query.studentId) {
            qb.andWhere('plan.studentId = :studentId', {
                studentId: query.studentId,
            });
        }
        if (query.schoolId) {
            qb.andWhere('student.schoolId = :schoolId', {
                schoolId: query.schoolId,
            });
        }
        const { limit, skip } = (0, pagination_1.normalizePagination)(query);
        return qb
            .orderBy('installment.dueDate', 'ASC')
            .skip(skip)
            .take(limit)
            .getMany();
    }
    async findOne(id, schoolId) {
        const installment = await this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .leftJoinAndSelect('installment.payments', 'payments')
            .where('installment.id = :id', { id })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .getOne();
        if (!installment) {
            throw new common_1.NotFoundException('قسط یافت نشد');
        }
        return installment;
    }
    async update(id, dto, schoolId, performedBy) {
        const installment = await this.findOne(id, schoolId);
        const before = { dueDate: installment.dueDate, amount: Number(installment.amount) };
        let changed = false;
        if (dto.dueDate !== undefined && dto.dueDate !== installment.dueDate) {
            installment.dueDate = dto.dueDate;
            changed = true;
        }
        if (dto.amount !== undefined && dto.amount !== installment.amount) {
            installment.amount = dto.amount;
            changed = true;
        }
        const saved = await this.installmentRepo.save(installment);
        if (changed) {
            const ownership = await this.dataSource
                .createQueryBuilder()
                .select('plan.student_id', 'studentId')
                .from('tuition_plans', 'plan')
                .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
                .where('i.id = :id', { id })
                .getRawOne();
            this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_UPDATED, new domain_events_1.InstallmentUpdatedEvent(schoolId, ownership?.studentId ?? '', saved.id, before, { dueDate: saved.dueDate, amount: Number(saved.amount) }, performedBy));
        }
        return saved;
    }
    async overrideStatus(id, dto, schoolId, performedBy) {
        return this.dataSource.transaction(async (manager) => {
            const installment = await manager
                .createQueryBuilder(installment_entity_1.Installment, 'installment')
                .innerJoin('installment.tuitionPlan', 'plan')
                .innerJoin('plan.student', 'student')
                .where('installment.id = :id', { id })
                .andWhere('student.schoolId = :schoolId', { schoolId })
                .setLock('pessimistic_write')
                .getOne();
            if (!installment) {
                throw new common_1.NotFoundException('قسط یافت نشد');
            }
            installment_state_machine_1.InstallmentStateMachine.assertTransition(installment.status, dto.status);
            const previous = installment.status;
            installment.status = dto.status;
            await manager.save(installment);
            const ownership = await manager
                .createQueryBuilder()
                .select('plan.studentId', 'studentId')
                .from('tuition_plans', 'plan')
                .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
                .where('i.id = :id', { id })
                .getRawOne();
            this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, new domain_events_1.InstallmentStatusChangedEvent(schoolId, ownership.studentId, installment.id, previous, dto.status, performedBy));
            return installment;
        });
    }
    async markOverdueInstallments() {
        const candidates = await this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .where('installment.dueDate < CURRENT_DATE')
            .andWhere('installment.status = :pending', {
            pending: installment_entity_1.InstallmentStatus.PENDING,
        })
            .select(['installment.id AS id', 'plan.studentId AS "studentId"'])
            .addSelect('plan.id', 'planId')
            .getRawMany();
        if (candidates.length === 0) {
            return [];
        }
        installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PENDING, installment_entity_1.InstallmentStatus.OVERDUE);
        await this.installmentRepo
            .createQueryBuilder()
            .update(installment_entity_1.Installment)
            .set({ status: installment_entity_1.InstallmentStatus.OVERDUE })
            .where('id IN (:...ids)', { ids: candidates.map((c) => c.id) })
            .execute();
        for (const c of candidates) {
            this.events.emit(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, new domain_events_1.InstallmentStatusChangedEvent('', c.studentId, c.id, installment_entity_1.InstallmentStatus.PENDING, installment_entity_1.InstallmentStatus.OVERDUE, null));
        }
        return candidates;
    }
    async findUpcomingDueInstallments(daysAhead) {
        return this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .where(`installment.dueDate = (CURRENT_DATE + make_interval(days => :daysAhead))::date`, { daysAhead })
            .andWhere('installment.status = :pending', {
            pending: installment_entity_1.InstallmentStatus.PENDING,
        })
            .select(['installment.id AS id', 'plan.studentId AS "studentId"'])
            .getRawMany();
    }
};
exports.InstallmentsService = InstallmentsService;
exports.InstallmentsService = InstallmentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(installment_entity_1.Installment)),
    __param(1, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2])
], InstallmentsService);
//# sourceMappingURL=installments.service.js.map