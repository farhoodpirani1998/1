"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuitionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const tuition_plan_entity_1 = require("./entities/tuition-plan.entity");
const installment_entity_1 = require("./entities/installment.entity");
const payment_entity_1 = require("./entities/payment.entity");
const student_entity_1 = require("../students/entities/student.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const user_entity_1 = require("../users/entities/user.entity");
const ledger_module_1 = require("../ledger/ledger.module");
const tuition_plans_controller_1 = require("./tuition-plans/tuition-plans.controller");
const tuition_plans_service_1 = require("./tuition-plans/tuition-plans.service");
const installments_controller_1 = require("./installments/installments.controller");
const installments_service_1 = require("./installments/installments.service");
const payments_controller_1 = require("./payments/payments.controller");
const payments_service_1 = require("./payments/payments.service");
let TuitionModule = class TuitionModule {
};
exports.TuitionModule = TuitionModule;
exports.TuitionModule = TuitionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                tuition_plan_entity_1.TuitionPlan,
                installment_entity_1.Installment,
                payment_entity_1.Payment,
                student_entity_1.Student,
                academic_year_entity_1.AcademicYear,
                user_entity_1.User,
            ]),
            ledger_module_1.LedgerModule,
        ],
        controllers: [
            tuition_plans_controller_1.TuitionPlansController,
            installments_controller_1.InstallmentsController,
            payments_controller_1.PaymentsController,
        ],
        providers: [tuition_plans_service_1.TuitionPlansService, installments_service_1.InstallmentsService, payments_service_1.PaymentsService],
        exports: [installments_service_1.InstallmentsService],
    })
], TuitionModule);
//# sourceMappingURL=tuition.module.js.map