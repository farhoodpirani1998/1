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
var OverdueInstallmentsCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverdueInstallmentsCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const installments_service_1 = require("../tuition/installments/installments.service");
const notifications_service_1 = require("../notifications/notifications.service");
let OverdueInstallmentsCron = OverdueInstallmentsCron_1 = class OverdueInstallmentsCron {
    constructor(installmentsService, notificationsService) {
        this.installmentsService = installmentsService;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(OverdueInstallmentsCron_1.name);
    }
    async handleOverdueInstallments() {
        const newlyOverdue = await this.installmentsService.markOverdueInstallments();
        if (newlyOverdue.length === 0) {
            this.logger.log('No installments became overdue tonight');
            return;
        }
        this.logger.log(`${newlyOverdue.length} installment(s) marked overdue — queueing reminders`);
        for (const installment of newlyOverdue) {
            await this.notificationsService.queueOverdueReminder(installment.id, installment.studentId);
        }
    }
};
exports.OverdueInstallmentsCron = OverdueInstallmentsCron;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OverdueInstallmentsCron.prototype, "handleOverdueInstallments", null);
exports.OverdueInstallmentsCron = OverdueInstallmentsCron = OverdueInstallmentsCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [installments_service_1.InstallmentsService,
        notifications_service_1.NotificationsService])
], OverdueInstallmentsCron);
//# sourceMappingURL=overdue-installments.cron.js.map