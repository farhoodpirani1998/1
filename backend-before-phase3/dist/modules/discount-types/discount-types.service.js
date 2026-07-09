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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountTypesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const discount_type_entity_1 = require("./entities/discount-type.entity");
let DiscountTypesService = class DiscountTypesService {
    constructor(discountTypeRepo) {
        this.discountTypeRepo = discountTypeRepo;
    }
    create(dto, schoolId) {
        const type = this.discountTypeRepo.create({
            schoolId,
            title: dto.title,
            defaultPercent: dto.defaultPercent ?? null,
            isActive: true,
        });
        return this.discountTypeRepo.save(type);
    }
    findAll(schoolId) {
        return this.discountTypeRepo.find({ where: { schoolId }, order: { title: 'ASC' } });
    }
    async findOne(id, schoolId) {
        const type = await this.discountTypeRepo.findOne({ where: { id, schoolId } });
        if (!type) {
            throw new common_1.NotFoundException('نوع تخفیف یافت نشد');
        }
        return type;
    }
    async update(id, dto, schoolId) {
        const type = await this.findOne(id, schoolId);
        Object.assign(type, dto);
        return this.discountTypeRepo.save(type);
    }
};
exports.DiscountTypesService = DiscountTypesService;
exports.DiscountTypesService = DiscountTypesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(discount_type_entity_1.DiscountType)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], DiscountTypesService);
//# sourceMappingURL=discount-types.service.js.map