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
exports.GuardiansService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const guardian_entity_1 = require("./entities/guardian.entity");
let GuardiansService = class GuardiansService {
    constructor(guardianRepo) {
        this.guardianRepo = guardianRepo;
    }
    async findOrCreate(dto, schoolId, manager) {
        const repo = manager ? manager.getRepository(guardian_entity_1.Guardian) : this.guardianRepo;
        const existing = await repo.findOne({
            where: { phone: dto.phone, schoolId },
        });
        if (existing) {
            return existing;
        }
        const guardian = repo.create({
            schoolId,
            fullName: dto.fullName,
            phone: dto.phone,
            nationalId: dto.nationalId ?? null,
        });
        return repo.save(guardian);
    }
    async findOne(id) {
        const guardian = await this.guardianRepo.findOne({ where: { id } });
        if (!guardian) {
            throw new common_1.NotFoundException('والد یافت نشد');
        }
        return guardian;
    }
};
exports.GuardiansService = GuardiansService;
exports.GuardiansService = GuardiansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(guardian_entity_1.Guardian)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], GuardiansService);
//# sourceMappingURL=guardians.service.js.map