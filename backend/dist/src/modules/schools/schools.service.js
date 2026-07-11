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
exports.SchoolsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const school_entity_1 = require("./entities/school.entity");
let SchoolsService = class SchoolsService {
    constructor(schoolRepo) {
        this.schoolRepo = schoolRepo;
    }
    create(dto) {
        const school = this.schoolRepo.create({ ...dto, isActive: true });
        return this.schoolRepo.save(school);
    }
    findAll() {
        return this.schoolRepo.find({ order: { name: 'ASC' } });
    }
    async findOne(id) {
        const school = await this.schoolRepo.findOne({ where: { id } });
        if (!school) {
            throw new common_1.NotFoundException('مدرسه یافت نشد');
        }
        return school;
    }
    async update(id, dto) {
        const school = await this.findOne(id);
        Object.assign(school, dto);
        return this.schoolRepo.save(school);
    }
    async deactivate(id) {
        return this.update(id, { isActive: false });
    }
};
exports.SchoolsService = SchoolsService;
exports.SchoolsService = SchoolsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(school_entity_1.School)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SchoolsService);
//# sourceMappingURL=schools.service.js.map