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
exports.TuitionPlansService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const tuition_plan_entity_1 = require("../entities/tuition-plan.entity");
const student_entity_1 = require("../../students/entities/student.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
const ledger_service_1 = require("../../ledger/ledger.service");
const permissions_1 = require("../../../common/authorization/permissions");
const domain_events_1 = require("../../../common/events/domain-events");
let TuitionPlansService = class TuitionPlansService {
    constructor(dataSource, ledger, events) {
        this.dataSource = dataSource;
        this.ledger = ledger;
        this.events = events;
    }
    async create(dto, schoolId, actingUser) {
        const discount = dto.discountAmount ?? 0;
        if (discount > dto.baseAmount) {
            throw new common_1.BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
        }
        if (discount > 0 && !(0, permissions_1.roleHasPermission)(actingUser.role, permissions_1.Permission.DISCOUNT_UNLIMITED)) {
            const ceiling = (permissions_1.DISCOUNT_CEILING_RATIO[actingUser.role] ?? 0) * dto.baseAmount;
            if (discount > ceiling) {
                throw new common_1.ForbiddenException(`تخفیف بیش از ${(permissions_1.DISCOUNT_CEILING_RATIO[actingUser.role] ?? 0) * 100}% نیاز به تأیید مدیر مدرسه دارد`);
            }
        }
        return this.dataSource.transaction(async (manager) => {
            const student = await manager.findOne(student_entity_1.Student, { where: { id: dto.studentId } });
            if (!student) {
                throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
            }
            if (student.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
            }
            const academicYear = await manager.findOne(academic_year_entity_1.AcademicYear, {
                where: { id: dto.academicYearId },
            });
            if (!academicYear) {
                throw new common_1.NotFoundException('سال تحصیلی یافت نشد');
            }
            if (academicYear.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
            }
            const duplicate = await manager.findOne(tuition_plan_entity_1.TuitionPlan, {
                where: { studentId: dto.studentId, academicYearId: dto.academicYearId },
            });
            if (duplicate) {
                throw new common_1.BadRequestException('برای این دانش‌آموز در این سال تحصیلی قبلاً یک برنامه شهریه ثبت شده است');
            }
            const plan = manager.create(tuition_plan_entity_1.TuitionPlan, {
                studentId: dto.studentId,
                academicYearId: dto.academicYearId,
                baseAmount: dto.baseAmount,
                discountAmount: discount,
                discountReason: dto.discountReason ?? null,
                finalAmount: dto.baseAmount - discount,
            });
            const saved = await manager.save(plan);
            await this.ledger.recordCharge(manager, {
                schoolId,
                studentId: dto.studentId,
                tuitionPlanId: saved.id,
                baseAmount: dto.baseAmount,
                discountAmount: discount,
                performedBy: actingUser.id,
            });
            this.events.emit(domain_events_1.DOMAIN_EVENTS.TUITION_PLAN_CREATED, new domain_events_1.TuitionPlanCreatedEvent(schoolId, dto.studentId, saved.id, dto.baseAmount, discount, saved.finalAmount, actingUser.id));
            return saved;
        });
    }
    async findOne(id, schoolId) {
        const plan = await this.dataSource
            .getRepository(tuition_plan_entity_1.TuitionPlan)
            .createQueryBuilder('plan')
            .innerJoin('plan.student', 'student')
            .leftJoinAndSelect('plan.installments', 'installments')
            .where('plan.id = :id', { id })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .getOne();
        if (!plan) {
            throw new common_1.NotFoundException('برنامه شهریه یافت نشد');
        }
        return plan;
    }
    async findByStudent(studentId, schoolId) {
        return this.dataSource
            .getRepository(tuition_plan_entity_1.TuitionPlan)
            .createQueryBuilder('plan')
            .innerJoin('plan.student', 'student')
            .where('plan.studentId = :studentId', { studentId })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .orderBy('plan.createdAt', 'DESC')
            .getMany();
    }
    async update(id, dto, actingUser, schoolId) {
        const result = await this.dataSource.transaction(async (manager) => {
            const plan = await manager.findOne(tuition_plan_entity_1.TuitionPlan, {
                where: { id },
                relations: ['installments'],
            });
            if (!plan) {
                throw new common_1.NotFoundException('برنامه شهریه یافت نشد');
            }
            const owner = await manager.findOne(student_entity_1.Student, { where: { id: plan.studentId } });
            if (!owner || owner.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
            }
            if (plan.installments?.length) {
                throw new common_1.BadRequestException('پس از ساخته‌شدن اقساط، امکان ویرایش تخفیف وجود ندارد');
            }
            const before = {
                discountAmount: Number(plan.discountAmount),
                discountReason: plan.discountReason,
            };
            let changed = false;
            if (dto.discountAmount !== undefined && dto.discountAmount !== plan.discountAmount) {
                if (dto.discountAmount > plan.baseAmount) {
                    throw new common_1.BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
                }
                const delta = dto.discountAmount - plan.discountAmount;
                if (delta !== 0) {
                    await this.ledger.recordDiscountAdjustment(manager, {
                        schoolId: owner.schoolId,
                        studentId: plan.studentId,
                        tuitionPlanId: plan.id,
                        deltaDiscount: delta,
                        performedBy: actingUser.id,
                    });
                }
                plan.discountAmount = dto.discountAmount;
                plan.finalAmount = plan.baseAmount - dto.discountAmount;
                changed = true;
            }
            if (dto.discountReason !== undefined && dto.discountReason !== plan.discountReason) {
                plan.discountReason = dto.discountReason;
                changed = true;
            }
            const saved = await manager.save(plan);
            return { saved, before, changed };
        });
        if (result.changed) {
            this.events.emit(domain_events_1.DOMAIN_EVENTS.TUITION_PLAN_UPDATED, new domain_events_1.TuitionPlanUpdatedEvent(schoolId, result.saved.studentId, result.saved.id, result.before, {
                discountAmount: Number(result.saved.discountAmount),
                discountReason: result.saved.discountReason,
            }, actingUser.id));
        }
        return result.saved;
    }
};
exports.TuitionPlansService = TuitionPlansService;
exports.TuitionPlansService = TuitionPlansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        ledger_service_1.LedgerService,
        event_emitter_1.EventEmitter2])
], TuitionPlansService);
//# sourceMappingURL=tuition-plans.service.js.map