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
exports.InstallmentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const installment_entity_1 = require("../entities/installment.entity");
const tuition_plan_entity_1 = require("../entities/tuition-plan.entity");
let InstallmentsService = class InstallmentsService {
    constructor(installmentRepo, tuitionPlanRepo) {
        this.installmentRepo = installmentRepo;
        this.tuitionPlanRepo = tuitionPlanRepo;
    }
    async generate(tuitionPlanId, dto) {
        const plan = await this.tuitionPlanRepo.findOne({
            where: { id: tuitionPlanId },
            relations: ['installments'],
        });
        if (!plan) {
            throw new common_1.NotFoundException('برنامه شهریه یافت نشد');
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
        return this.installmentRepo.save(installments);
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
        return qb.orderBy('installment.dueDate', 'ASC').getMany();
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
    async update(id, dto, schoolId) {
        const installment = await this.findOne(id, schoolId);
        if (dto.dueDate !== undefined)
            installment.dueDate = dto.dueDate;
        if (dto.amount !== undefined)
            installment.amount = dto.amount;
        return this.installmentRepo.save(installment);
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
            .getRawMany();
        if (candidates.length === 0) {
            return [];
        }
        await this.installmentRepo
            .createQueryBuilder()
            .update(installment_entity_1.Installment)
            .set({ status: installment_entity_1.InstallmentStatus.OVERDUE })
            .where('id IN (:...ids)', { ids: candidates.map((c) => c.id) })
            .execute();
        return candidates;
    }
};
exports.InstallmentsService = InstallmentsService;
exports.InstallmentsService = InstallmentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(installment_entity_1.Installment)),
    __param(1, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object])
], InstallmentsService);
//# sourceMappingURL=installments.service.js.map