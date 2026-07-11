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
var UpcomingDueInstallmentsCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpcomingDueInstallmentsCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const installments_service_1 = require("../tuition/installments/installments.service");
const notifications_service_1 = require("../notifications/notifications.service");
const UPCOMING_DUE_CRON_LOCK_KEY = 721_900_002;
const UPCOMING_DUE_DAYS_AHEAD = 3;
let UpcomingDueInstallmentsCron = UpcomingDueInstallmentsCron_1 = class UpcomingDueInstallmentsCron {
    constructor(installmentsService, notificationsService, dataSource) {
        this.installmentsService = installmentsService;
        this.notificationsService = notificationsService;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(UpcomingDueInstallmentsCron_1.name);
    }
    async handleUpcomingDueInstallments() {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const [{ locked }] = await queryRunner.query('SELECT pg_try_advisory_lock($1) AS locked', [UPCOMING_DUE_CRON_LOCK_KEY]);
            if (!locked) {
                this.logger.log('Another instance already holds the upcoming-due-installments lock — skipping this run');
                return;
            }
            try {
                const candidates = await this.installmentsService.findUpcomingDueInstallments(UPCOMING_DUE_DAYS_AHEAD);
                if (candidates.length === 0) {
                    this.logger.log('No installments becoming due soon tonight');
                    return;
                }
                for (const c of candidates) {
                    try {
                        await this.notificationsService.queueUpcomingDueReminder(c.id, c.studentId);
                    }
                    catch (err) {
                        this.logger.error(`Failed to queue upcoming-due reminder for installment ${c.id}`, err);
                    }
                }
                this.logger.log(`${candidates.length} upcoming-due reminder(s) queued`);
            }
            catch (err) {
                this.logger.error(`Failed to process upcoming-due installments: ${err?.message ?? err}`, err?.stack);
            }
            finally {
                await queryRunner.query('SELECT pg_advisory_unlock($1)', [UPCOMING_DUE_CRON_LOCK_KEY]);
            }
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.UpcomingDueInstallmentsCron = UpcomingDueInstallmentsCron;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UpcomingDueInstallmentsCron.prototype, "handleUpcomingDueInstallments", null);
exports.UpcomingDueInstallmentsCron = UpcomingDueInstallmentsCron = UpcomingDueInstallmentsCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [installments_service_1.InstallmentsService,
        notifications_service_1.NotificationsService,
        typeorm_2.DataSource])
], UpcomingDueInstallmentsCron);
//# sourceMappingURL=upcoming-due-installments.cron.js.map