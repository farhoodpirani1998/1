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
exports.AnnouncementsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const announcement_entity_1 = require("./entities/announcement.entity");
let AnnouncementsService = class AnnouncementsService {
    constructor(announcementRepo) {
        this.announcementRepo = announcementRepo;
    }
    async create(dto, schoolId, createdById) {
        const announcement = this.announcementRepo.create({
            schoolId,
            title: dto.title,
            message: dto.message,
            targetType: dto.targetType,
            createdById,
        });
        return this.announcementRepo.save(announcement);
    }
    async findAllForSchool(schoolId) {
        return this.announcementRepo.find({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
    }
    async delete(id, schoolId) {
        const announcement = await this.announcementRepo.findOne({ where: { id, schoolId } });
        if (!announcement) {
            throw new common_1.NotFoundException('اطلاعیه یافت نشد');
        }
        await this.announcementRepo.remove(announcement);
    }
    async findForAudience(schoolId, audience) {
        return this.announcementRepo.find({
            where: { schoolId, targetType: (0, typeorm_2.In)([announcement_entity_1.AnnouncementTargetType.ALL, audience]) },
            order: { createdAt: 'DESC' },
        });
    }
};
exports.AnnouncementsService = AnnouncementsService;
exports.AnnouncementsService = AnnouncementsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(announcement_entity_1.Announcement)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AnnouncementsService);
//# sourceMappingURL=announcements.service.js.map