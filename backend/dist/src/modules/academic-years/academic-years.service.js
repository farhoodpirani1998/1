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
exports.AcademicYearsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const academic_year_entity_1 = require("./entities/academic-year.entity");
let AcademicYearsService = class AcademicYearsService {
    constructor(academicYearRepo, dataSource) {
        this.academicYearRepo = academicYearRepo;
        this.dataSource = dataSource;
    }
    async create(dto, schoolId) {
        return this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(academic_year_entity_1.AcademicYear);
            if (dto.isCurrent) {
                await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
            }
            const year = repo.create({
                schoolId,
                title: dto.title,
                startDate: dto.startDate ?? null,
                endDate: dto.endDate ?? null,
                isCurrent: dto.isCurrent ?? false,
            });
            return repo.save(year);
        });
    }
    findAll(schoolId) {
        return this.academicYearRepo.find({
            where: { schoolId },
            order: { startDate: 'DESC' },
        });
    }
    async findOne(id, schoolId) {
        const year = await this.academicYearRepo.findOne({ where: { id, schoolId } });
        if (!year) {
            throw new common_1.NotFoundException('سال تحصیلی یافت نشد');
        }
        return year;
    }
    async update(id, dto, schoolId) {
        return this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(academic_year_entity_1.AcademicYear);
            const year = await repo.findOne({ where: { id, schoolId } });
            if (!year) {
                throw new common_1.NotFoundException('سال تحصیلی یافت نشد');
            }
            if (dto.isCurrent) {
                await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
            }
            Object.assign(year, dto);
            return repo.save(year);
        });
    }
};
exports.AcademicYearsService = AcademicYearsService;
exports.AcademicYearsService = AcademicYearsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(academic_year_entity_1.AcademicYear)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], AcademicYearsService);
//# sourceMappingURL=academic-years.service.js.map