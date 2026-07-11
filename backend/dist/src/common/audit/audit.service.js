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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("./audit-log.entity");
let AuditService = AuditService_1 = class AuditService {
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
        this.logger = new common_1.Logger(AuditService_1.name);
    }
    async record(params) {
        try {
            await this.auditRepo.insert({
                schoolId: params.schoolId,
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                oldValue: params.oldValue ?? null,
                newValue: params.newValue ?? null,
            });
        }
        catch (err) {
            this.logger.error(`Failed to write audit log for ${params.action} on ${params.entityType}:${params.entityId}`, err);
        }
    }
    async findForEntity(entityType, entityId) {
        return this.auditRepo.find({
            where: { entityType, entityId },
            order: { createdAt: 'DESC' },
        });
    }
    async findForSchool(schoolId, limit = 100) {
        return this.auditRepo.find({
            where: { schoolId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditService);
//# sourceMappingURL=audit.service.js.map