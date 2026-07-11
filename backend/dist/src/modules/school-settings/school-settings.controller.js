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
exports.SchoolSettingsController = void 0;
const common_1 = require("@nestjs/common");
const school_settings_service_1 = require("./school-settings.service");
const update_school_settings_dto_1 = require("./dto/update-school-settings.dto");
const school_settings_view_dto_1 = require("./dto/school-settings-view.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let SchoolSettingsController = class SchoolSettingsController {
    constructor(schoolSettingsService) {
        this.schoolSettingsService = schoolSettingsService;
    }
    async findMine(schoolId) {
        const settings = await this.schoolSettingsService.findOrCreate(schoolId);
        return (0, school_settings_view_dto_1.toSchoolSettingsView)(settings);
    }
    async update(dto, schoolId) {
        const settings = await this.schoolSettingsService.update(schoolId, dto);
        return (0, school_settings_view_dto_1.toSchoolSettingsView)(settings);
    }
};
exports.SchoolSettingsController = SchoolSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SchoolSettingsController.prototype, "findMine", null);
__decorate([
    (0, common_1.Put)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_school_settings_dto_1.UpdateSchoolSettingsDto, String]),
    __metadata("design:returntype", Promise)
], SchoolSettingsController.prototype, "update", null);
exports.SchoolSettingsController = SchoolSettingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [school_settings_service_1.SchoolSettingsService])
], SchoolSettingsController);
//# sourceMappingURL=school-settings.controller.js.map