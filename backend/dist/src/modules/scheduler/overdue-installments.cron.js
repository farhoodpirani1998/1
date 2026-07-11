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
var OverdueInstallmentsCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverdueInstallmentsCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const installments_service_1 = require("../tuition/installments/installments.service");
const OVERDUE_CRON_LOCK_KEY = 721_900_001;
let OverdueInstallmentsCron = OverdueInstallmentsCron_1 = class OverdueInstallmentsCron {
    constructor(installmentsService, dataSource) {
        this.installmentsService = installmentsService;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(OverdueInstallmentsCron_1.name);
    }
    async handleOverdueInstallments() {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            const [{ locked }] = await queryRunner.query('SELECT pg_try_advisory_lock($1) AS locked', [OVERDUE_CRON_LOCK_KEY]);
            if (!locked) {
                this.logger.log('Another instance already holds the overdue-installments lock — skipping this run');
                return;
            }
            try {
                const newlyOverdue = await this.installmentsService.markOverdueInstallments();
                if (newlyOverdue.length === 0) {
                    this.logger.log('No installments became overdue tonight');
                    return;
                }
                this.logger.log(`${newlyOverdue.length} installment(s) marked overdue`);
            }
            catch (err) {
                this.logger.error(`Failed to process overdue installments: ${err?.message ?? err}`, err?.stack);
            }
            finally {
                await queryRunner.query('SELECT pg_advisory_unlock($1)', [OVERDUE_CRON_LOCK_KEY]);
            }
        }
        finally {
            await queryRunner.release();
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
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [installments_service_1.InstallmentsService,
        typeorm_2.DataSource])
], OverdueInstallmentsCron);
//# sourceMappingURL=overdue-installments.cron.js.map