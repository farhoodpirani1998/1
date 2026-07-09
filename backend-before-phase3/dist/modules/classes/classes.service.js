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
exports.ClassesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const class_entity_1 = require("./entities/class.entity");
let ClassesService = class ClassesService {
    constructor(classRepo) {
        this.classRepo = classRepo;
    }
    create(dto, schoolId) {
        const klass = this.classRepo.create({
            schoolId,
            gradeId: dto.gradeId,
            academicYearId: dto.academicYearId,
            title: dto.title,
            teacherName: dto.teacherName ?? null,
            capacity: dto.capacity ?? null,
        });
        return this.classRepo.save(klass);
    }
    findAll(schoolId, academicYearId) {
        return this.classRepo.find({
            where: academicYearId ? { schoolId, academicYearId } : { schoolId },
            relations: ['grade'],
            order: { title: 'ASC' },
        });
    }
    async findOne(id, schoolId) {
        const klass = await this.classRepo.findOne({ where: { id, schoolId }, relations: ['grade'] });
        if (!klass) {
            throw new common_1.NotFoundException('کلاس یافت نشد');
        }
        return klass;
    }
    async update(id, dto, schoolId) {
        const klass = await this.findOne(id, schoolId);
        Object.assign(klass, dto);
        return this.classRepo.save(klass);
    }
};
exports.ClassesService = ClassesService;
exports.ClassesService = ClassesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(class_entity_1.Class)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], ClassesService);
//# sourceMappingURL=classes.service.js.map