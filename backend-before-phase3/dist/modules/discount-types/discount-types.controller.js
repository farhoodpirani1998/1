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
exports.DiscountTypesController = void 0;
const common_1 = require("@nestjs/common");
const discount_types_service_1 = require("./discount-types.service");
const create_discount_type_dto_1 = require("./dto/create-discount-type.dto");
const update_discount_type_dto_1 = require("./dto/update-discount-type.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let DiscountTypesController = class DiscountTypesController {
    constructor(discountTypesService) {
        this.discountTypesService = discountTypesService;
    }
    create(dto, schoolId) {
        return this.discountTypesService.create(dto, schoolId);
    }
    findAll(schoolId) {
        return this.discountTypesService.findAll(schoolId);
    }
    update(id, dto, schoolId) {
        return this.discountTypesService.update(id, dto, schoolId);
    }
};
exports.DiscountTypesController = DiscountTypesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_discount_type_dto_1.CreateDiscountTypeDto, String]),
    __metadata("design:returntype", void 0)
], DiscountTypesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DiscountTypesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('school_admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_discount_type_dto_1.UpdateDiscountTypeDto, String]),
    __metadata("design:returntype", void 0)
], DiscountTypesController.prototype, "update", null);
exports.DiscountTypesController = DiscountTypesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('discount-types'),
    __metadata("design:paramtypes", [discount_types_service_1.DiscountTypesService])
], DiscountTypesController);
//# sourceMappingURL=discount-types.controller.js.map