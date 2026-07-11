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
exports.SchoolSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const school_settings_entity_1 = require("./entities/school-settings.entity");
const school_entity_1 = require("../schools/entities/school.entity");
const timetable_entry_entity_1 = require("../timetable/entities/timetable-entry.entity");
const POSTGRES_UNIQUE_VIOLATION = '23505';
let SchoolSettingsService = class SchoolSettingsService {
    constructor(settingsRepo, schoolRepo) {
        this.settingsRepo = settingsRepo;
        this.schoolRepo = schoolRepo;
    }
    async findOrCreate(schoolId) {
        const existing = await this.settingsRepo.findOne({ where: { schoolId } });
        if (existing) {
            return existing;
        }
        return this.createDefault(schoolId);
    }
    async update(schoolId, dto) {
        const settings = await this.findOrCreate(schoolId);
        Object.assign(settings, {
            schoolName: dto.schoolName ?? settings.schoolName,
            logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : settings.logoUrl,
            address: dto.address !== undefined ? dto.address : settings.address,
            phone: dto.phone !== undefined ? dto.phone : settings.phone,
            email: dto.email !== undefined ? dto.email : settings.email,
            website: dto.website !== undefined ? dto.website : settings.website,
            timezone: dto.timezone ?? settings.timezone,
            language: dto.language ?? settings.language,
            currency: dto.currency ?? settings.currency,
            weekStartsOn: dto.weekStartsOn ?? settings.weekStartsOn,
            workingDays: dto.workingDays ?? settings.workingDays,
            passingScore: dto.passingScore ?? settings.passingScore,
            attendanceLateMinutes: dto.attendanceLateMinutes ?? settings.attendanceLateMinutes,
            tuitionReminderDays: dto.tuitionReminderDays ?? settings.tuitionReminderDays,
            smsEnabled: dto.smsEnabled ?? settings.smsEnabled,
            emailEnabled: dto.emailEnabled ?? settings.emailEnabled,
            primaryColor: dto.primaryColor !== undefined ? dto.primaryColor : settings.primaryColor,
            secondaryColor: dto.secondaryColor !== undefined ? dto.secondaryColor : settings.secondaryColor,
        });
        return this.settingsRepo.save(settings);
    }
    async createDefault(schoolId) {
        const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
        if (!school) {
            throw new common_1.NotFoundException('مدرسه یافت نشد');
        }
        const settings = this.settingsRepo.create({
            schoolId,
            schoolName: school.name,
            logoUrl: null,
            address: school.address ?? null,
            phone: school.phone ?? null,
            email: null,
            website: null,
            timezone: 'Asia/Tehran',
            language: 'fa',
            currency: 'IRR',
            weekStartsOn: timetable_entry_entity_1.Weekday.SATURDAY,
            workingDays: [
                timetable_entry_entity_1.Weekday.SATURDAY,
                timetable_entry_entity_1.Weekday.SUNDAY,
                timetable_entry_entity_1.Weekday.MONDAY,
                timetable_entry_entity_1.Weekday.TUESDAY,
                timetable_entry_entity_1.Weekday.WEDNESDAY,
            ],
            passingScore: 10,
            attendanceLateMinutes: 15,
            tuitionReminderDays: 7,
            smsEnabled: true,
            emailEnabled: false,
            primaryColor: null,
            secondaryColor: null,
        });
        try {
            return await this.settingsRepo.save(settings);
        }
        catch (err) {
            if (err instanceof typeorm_2.QueryFailedError && err.code === POSTGRES_UNIQUE_VIOLATION) {
                const winner = await this.settingsRepo.findOne({ where: { schoolId } });
                if (winner) {
                    return winner;
                }
            }
            throw err;
        }
    }
};
exports.SchoolSettingsService = SchoolSettingsService;
exports.SchoolSettingsService = SchoolSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(school_settings_entity_1.SchoolSettings)),
    __param(1, (0, typeorm_1.InjectRepository)(school_entity_1.School)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], SchoolSettingsService);
//# sourceMappingURL=school-settings.service.js.map