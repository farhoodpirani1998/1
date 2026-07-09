"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountTypesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const discount_type_entity_1 = require("./entities/discount-type.entity");
const discount_types_controller_1 = require("./discount-types.controller");
const discount_types_service_1 = require("./discount-types.service");
let DiscountTypesModule = class DiscountTypesModule {
};
exports.DiscountTypesModule = DiscountTypesModule;
exports.DiscountTypesModule = DiscountTypesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([discount_type_entity_1.DiscountType])],
        controllers: [discount_types_controller_1.DiscountTypesController],
        providers: [discount_types_service_1.DiscountTypesService],
        exports: [discount_types_service_1.DiscountTypesService],
    })
], DiscountTypesModule);
//# sourceMappingURL=discount-types.module.js.map