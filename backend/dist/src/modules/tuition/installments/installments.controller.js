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
exports.InstallmentsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const installments_service_1 = require("./installments.service");
const generate_installments_dto_1 = require("../dto/generate-installments.dto");
const query_installments_dto_1 = require("../dto/query-installments.dto");
const update_installment_dto_1 = require("../dto/update-installment.dto");
const override_installment_status_dto_1 = require("../dto/override-installment-status.dto");
const jwt_auth_guard_1 = require("../../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const permissions_guard_1 = require("../../../common/authorization/permissions.guard");
const require_permission_decorator_1 = require("../../../common/authorization/require-permission.decorator");
const permissions_1 = require("../../../common/authorization/permissions");
let InstallmentsController = class InstallmentsController {
    constructor(installmentsService) {
        this.installmentsService = installmentsService;
    }
    generate(tuitionPlanId, dto, schoolId) {
        return this.installmentsService.generate(tuitionPlanId, dto, schoolId);
    }
    findWithFilters(query, schoolId) {
        return this.installmentsService.findWithFilters({ ...query, schoolId });
    }
    findOne(id, schoolId) {
        return this.installmentsService.findOne(id, schoolId);
    }
    update(id, dto, user) {
        return this.installmentsService.update(id, dto, user.schoolId, user.id);
    }
    overrideStatus(id, dto, user) {
        return this.installmentsService.overrideStatus(id, dto, user.schoolId, user.id);
    }
};
exports.InstallmentsController = InstallmentsController;
__decorate([
    (0, common_1.Post)('tuition-plans/:id/installments/generate'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_installments_dto_1.GenerateInstallmentsDto, String]),
    __metadata("design:returntype", void 0)
], InstallmentsController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)('installments'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_installments_dto_1.QueryInstallmentsDto, String]),
    __metadata("design:returntype", void 0)
], InstallmentsController.prototype, "findWithFilters", null);
__decorate([
    (0, common_1.Get)('installments/:id'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], InstallmentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('installments/:id'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_installment_dto_1.UpdateInstallmentDto, Object]),
    __metadata("design:returntype", void 0)
], InstallmentsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('installments/:id/status'),
    (0, roles_decorator_1.Roles)('school_admin', 'accountant'),
    (0, require_permission_decorator_1.RequirePermission)(permissions_1.Permission.INSTALLMENT_STATUS_OVERRIDE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, override_installment_status_dto_1.OverrideInstallmentStatusDto, Object]),
    __metadata("design:returntype", void 0)
], InstallmentsController.prototype, "overrideStatus", null);
exports.InstallmentsController = InstallmentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [installments_service_1.InstallmentsService])
], InstallmentsController);
//# sourceMappingURL=installments.controller.js.map