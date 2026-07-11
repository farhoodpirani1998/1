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
exports.OverrideInstallmentStatusDto = void 0;
const class_validator_1 = require("class-validator");
const installment_entity_1 = require("../entities/installment.entity");
class OverrideInstallmentStatusDto {
}
exports.OverrideInstallmentStatusDto = OverrideInstallmentStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(installment_entity_1.InstallmentStatus),
    __metadata("design:type", String)
], OverrideInstallmentStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], OverrideInstallmentStatusDto.prototype, "reason", void 0);
//# sourceMappingURL=override-installment-status.dto.js.map