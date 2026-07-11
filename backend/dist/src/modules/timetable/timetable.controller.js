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
exports.TimetableController = void 0;
const common_1 = require("@nestjs/common");
const timetable_service_1 = require("./timetable.service");
const create_timetable_entry_dto_1 = require("./dto/create-timetable-entry.dto");
const update_timetable_entry_dto_1 = require("./dto/update-timetable-entry.dto");
const query_timetable_dto_1 = require("./dto/query-timetable.dto");
const timetable_entry_view_dto_1 = require("./dto/timetable-entry-view.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let TimetableController = class TimetableController {
    constructor(timetableService) {
        this.timetableService = timetableService;
    }
    async create(dto, schoolId) {
        const entry = await this.timetableService.create(dto, schoolId);
        return (0, timetable_entry_view_dto_1.toTimetableEntryView)(entry);
    }
    async findAll(query, schoolId) {
        const entries = await this.timetableService.findAllForSchool(schoolId, query);
        return entries.map(timetable_entry_view_dto_1.toTimetableEntryView);
    }
    async update(id, dto, schoolId) {
        const entry = await this.timetableService.update(id, dto, schoolId);
        return (0, timetable_entry_view_dto_1.toTimetableEntryView)(entry);
    }
    async remove(id, schoolId) {
        await this.timetableService.remove(id, schoolId);
    }
};
exports.TimetableController = TimetableController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_timetable_entry_dto_1.CreateTimetableEntryDto, String]),
    __metadata("design:returntype", Promise)
], TimetableController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_timetable_dto_1.QueryTimetableDto, String]),
    __metadata("design:returntype", Promise)
], TimetableController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_timetable_entry_dto_1.UpdateTimetableEntryDto, String]),
    __metadata("design:returntype", Promise)
], TimetableController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TimetableController.prototype, "remove", null);
exports.TimetableController = TimetableController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('timetable'),
    __metadata("design:paramtypes", [timetable_service_1.TimetableService])
], TimetableController);
//# sourceMappingURL=timetable.controller.js.map