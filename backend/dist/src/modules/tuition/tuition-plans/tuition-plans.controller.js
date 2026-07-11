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
exports.TuitionPlansController = void 0;
const common_1 = require("@nestjs/common");
const tuition_plans_service_1 = require("./tuition-plans.service");
const create_tuition_plan_dto_1 = require("../dto/create-tuition-plan.dto");
const update_tuition_plan_dto_1 = require("../dto/update-tuition-plan.dto");
const jwt_auth_guard_1 = require("../../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
let TuitionPlansController = class TuitionPlansController {
    constructor(tuitionPlansService) {
        this.tuitionPlansService = tuitionPlansService;
    }
    create(dto, user) {
        return this.tuitionPlansService.create(dto, user.schoolId, { id: user.id, role: user.role });
    }
    findOne(id, schoolId) {
        return this.tuitionPlansService.findOne(id, schoolId);
    }
    findByStudent(studentId, schoolId) {
        return this.tuitionPlansService.findByStudent(studentId, schoolId);
    }
    update(id, dto, user) {
        return this.tuitionPlansService.update(id, dto, user, user.schoolId);
    }
};
exports.TuitionPlansController = TuitionPlansController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tuition_plan_dto_1.CreateTuitionPlanDto, Object]),
    __metadata("design:returntype", void 0)
], TuitionPlansController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant', 'staff'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TuitionPlansController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant', 'staff'),
    __param(0, (0, common_1.Query)('studentId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TuitionPlansController.prototype, "findByStudent", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_tuition_plan_dto_1.UpdateTuitionPlanDto, Object]),
    __metadata("design:returntype", void 0)
], TuitionPlansController.prototype, "update", null);
exports.TuitionPlansController = TuitionPlansController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('tuition-plans'),
    __metadata("design:paramtypes", [tuition_plans_service_1.TuitionPlansService])
], TuitionPlansController);
//# sourceMappingURL=tuition-plans.controller.js.map