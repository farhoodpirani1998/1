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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuitionPlansService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tuition_plan_entity_1 = require("../entities/tuition-plan.entity");
const student_entity_1 = require("../../students/entities/student.entity");
const discount_type_entity_1 = require("../../discount-types/entities/discount-type.entity");
let TuitionPlansService = class TuitionPlansService {
    constructor(tuitionPlanRepo, studentRepo, discountTypeRepo) {
        this.tuitionPlanRepo = tuitionPlanRepo;
        this.studentRepo = studentRepo;
        this.discountTypeRepo = discountTypeRepo;
    }
    async resolveDiscountAmount(baseAmount, discountTypeId, discountAmount, schoolId) {
        if (discountAmount !== undefined) {
            return discountAmount;
        }
        if (!discountTypeId) {
            return 0;
        }
        const type = await this.discountTypeRepo.findOne({ where: { id: discountTypeId, schoolId } });
        if (!type) {
            throw new common_1.NotFoundException('نوع تخفیف یافت نشد');
        }
        if (!type.defaultPercent) {
            return 0;
        }
        return Math.round((baseAmount * Number(type.defaultPercent)) / 100);
    }
    async create(dto, schoolId) {
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        if (student.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
        }
        const discount = await this.resolveDiscountAmount(dto.baseAmount, dto.discountTypeId, dto.discountAmount, schoolId);
        if (discount > dto.baseAmount) {
            throw new common_1.BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
        }
        const plan = this.tuitionPlanRepo.create({
            studentId: dto.studentId,
            academicYearId: dto.academicYearId,
            baseAmount: dto.baseAmount,
            discountAmount: discount,
            discountTypeId: dto.discountTypeId ?? null,
            discountReason: dto.discountReason ?? null,
            finalAmount: dto.baseAmount - discount,
        });
        return this.tuitionPlanRepo.save(plan);
    }
    async findOne(id) {
        const plan = await this.tuitionPlanRepo.findOne({
            where: { id },
            relations: ['installments'],
        });
        if (!plan) {
            throw new common_1.NotFoundException('برنامه شهریه یافت نشد');
        }
        return plan;
    }
    async findByStudent(studentId) {
        return this.tuitionPlanRepo.find({
            where: { studentId },
            order: { createdAt: 'DESC' },
        });
    }
    async update(id, dto, schoolId) {
        const plan = await this.findOne(id);
        if (plan.installments?.length) {
            throw new common_1.BadRequestException('پس از ساخته‌شدن اقساط، امکان ویرایش تخفیف وجود ندارد');
        }
        if (dto.discountTypeId !== undefined || dto.discountAmount !== undefined) {
            const discount = await this.resolveDiscountAmount(Number(plan.baseAmount), dto.discountTypeId, dto.discountAmount, schoolId);
            if (discount > Number(plan.baseAmount)) {
                throw new common_1.BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
            }
            plan.discountAmount = discount;
            plan.discountTypeId = dto.discountTypeId ?? plan.discountTypeId;
            plan.finalAmount = Number(plan.baseAmount) - discount;
        }
        if (dto.discountReason !== undefined) {
            plan.discountReason = dto.discountReason;
        }
        return this.tuitionPlanRepo.save(plan);
    }
};
exports.TuitionPlansService = TuitionPlansService;
exports.TuitionPlansService = TuitionPlansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __param(1, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(2, (0, typeorm_1.InjectRepository)(discount_type_entity_1.DiscountType)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _b : Object, typeof (_c = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _c : Object])
], TuitionPlansService);
//# sourceMappingURL=tuition-plans.service.js.map