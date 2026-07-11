"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchoolSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const school_settings_entity_1 = require("./entities/school-settings.entity");
const school_entity_1 = require("../schools/entities/school.entity");
const school_settings_controller_1 = require("./school-settings.controller");
const school_settings_service_1 = require("./school-settings.service");
let SchoolSettingsModule = class SchoolSettingsModule {
};
exports.SchoolSettingsModule = SchoolSettingsModule;
exports.SchoolSettingsModule = SchoolSettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([school_settings_entity_1.SchoolSettings, school_entity_1.School])],
        controllers: [school_settings_controller_1.SchoolSettingsController],
        providers: [school_settings_service_1.SchoolSettingsService],
        exports: [school_settings_service_1.SchoolSettingsService],
    })
], SchoolSettingsModule);
//# sourceMappingURL=school-settings.module.js.map