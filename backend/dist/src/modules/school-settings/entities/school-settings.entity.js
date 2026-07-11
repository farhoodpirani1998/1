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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchoolSettings = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const timetable_entry_entity_1 = require("../../timetable/entities/timetable-entry.entity");
let SchoolSettings = class SchoolSettings {
};
exports.SchoolSettings = SchoolSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'school_id' }),
    __metadata("design:type", String)
], SchoolSettings.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], SchoolSettings.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_name', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], SchoolSettings.prototype, "schoolName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'logo_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'Asia/Tehran' }),
    __metadata("design:type", String)
], SchoolSettings.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'fa' }),
    __metadata("design:type", String)
], SchoolSettings.prototype, "language", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'IRR' }),
    __metadata("design:type", String)
], SchoolSettings.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'week_starts_on', type: 'smallint', default: timetable_entry_entity_1.Weekday.SATURDAY }),
    __metadata("design:type", Number)
], SchoolSettings.prototype, "weekStartsOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'working_days', type: 'smallint', array: true, default: '{0,1,2,3,4}' }),
    __metadata("design:type", Array)
], SchoolSettings.prototype, "workingDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'passing_score', type: 'numeric', precision: 5, scale: 2, default: 10 }),
    __metadata("design:type", Number)
], SchoolSettings.prototype, "passingScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attendance_late_minutes', type: 'smallint', default: 15 }),
    __metadata("design:type", Number)
], SchoolSettings.prototype, "attendanceLateMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tuition_reminder_days', type: 'smallint', default: 7 }),
    __metadata("design:type", Number)
], SchoolSettings.prototype, "tuitionReminderDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sms_enabled', default: true }),
    __metadata("design:type", Boolean)
], SchoolSettings.prototype, "smsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_enabled', default: false }),
    __metadata("design:type", Boolean)
], SchoolSettings.prototype, "emailEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'primary_color', type: 'varchar', length: 7, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "primaryColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'secondary_color', type: 'varchar', length: 7, nullable: true }),
    __metadata("design:type", Object)
], SchoolSettings.prototype, "secondaryColor", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], SchoolSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], SchoolSettings.prototype, "updatedAt", void 0);
exports.SchoolSettings = SchoolSettings = __decorate([
    (0, typeorm_1.Entity)('school_settings')
], SchoolSettings);
//# sourceMappingURL=school-settings.entity.js.map