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
exports.CreateTimetableEntryDto = void 0;
const class_validator_1 = require("class-validator");
const timetable_entry_entity_1 = require("../entities/timetable-entry.entity");
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
class CreateTimetableEntryDto {
}
exports.CreateTimetableEntryDto = CreateTimetableEntryDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "academicYearId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "gradeId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "subjectId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "teacherId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(timetable_entry_entity_1.Weekday),
    __metadata("design:type", Number)
], CreateTimetableEntryDto.prototype, "weekday", void 0);
__decorate([
    (0, class_validator_1.Matches)(TIME_PATTERN, { message: 'startTime باید به فرمت HH:MM باشد' }),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.Matches)(TIME_PATTERN, { message: 'endTime باید به فرمت HH:MM باشد' }),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateTimetableEntryDto.prototype, "room", void 0);
//# sourceMappingURL=create-timetable-entry.dto.js.map