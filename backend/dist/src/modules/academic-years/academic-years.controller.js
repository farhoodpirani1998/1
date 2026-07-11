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
exports.AcademicYearsController = void 0;
const common_1 = require("@nestjs/common");
const academic_years_service_1 = require("./academic-years.service");
const create_academic_year_dto_1 = require("./dto/create-academic-year.dto");
const update_academic_year_dto_1 = require("./dto/update-academic-year.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let AcademicYearsController = class AcademicYearsController {
    constructor(academicYearsService) {
        this.academicYearsService = academicYearsService;
    }
    create(dto, schoolId) {
        return this.academicYearsService.create(dto, schoolId);
    }
    findAll(schoolId) {
        return this.academicYearsService.findAll(schoolId);
    }
    findOne(id, schoolId) {
        return this.academicYearsService.findOne(id, schoolId);
    }
    update(id, dto, schoolId) {
        return this.academicYearsService.update(id, dto, schoolId);
    }
};
exports.AcademicYearsController = AcademicYearsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_academic_year_dto_1.CreateAcademicYearDto, String]),
    __metadata("design:returntype", void 0)
], AcademicYearsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant', 'staff'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AcademicYearsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant', 'staff'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AcademicYearsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_academic_year_dto_1.UpdateAcademicYearDto, String]),
    __metadata("design:returntype", void 0)
], AcademicYearsController.prototype, "update", null);
exports.AcademicYearsController = AcademicYearsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('academic-years'),
    __metadata("design:paramtypes", [academic_years_service_1.AcademicYearsService])
], AcademicYearsController);
//# sourceMappingURL=academic-years.controller.js.map