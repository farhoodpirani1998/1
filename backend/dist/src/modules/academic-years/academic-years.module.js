"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcademicYearsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const academic_year_entity_1 = require("./entities/academic-year.entity");
const academic_years_controller_1 = require("./academic-years.controller");
const academic_years_service_1 = require("./academic-years.service");
let AcademicYearsModule = class AcademicYearsModule {
};
exports.AcademicYearsModule = AcademicYearsModule;
exports.AcademicYearsModule = AcademicYearsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([academic_year_entity_1.AcademicYear])],
        controllers: [academic_years_controller_1.AcademicYearsController],
        providers: [academic_years_service_1.AcademicYearsService],
        exports: [academic_years_service_1.AcademicYearsService],
    })
], AcademicYearsModule);
//# sourceMappingURL=academic-years.module.js.map