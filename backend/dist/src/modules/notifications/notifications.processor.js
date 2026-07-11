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
var NotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notifications_service_1 = require("./notifications.service");
const sms_provider_service_1 = require("./sms/sms-provider.service");
const notification_entity_1 = require("./entities/notification.entity");
let NotificationsProcessor = NotificationsProcessor_1 = class NotificationsProcessor extends bullmq_1.WorkerHost {
    constructor(notificationRepo, smsProvider, notificationsService) {
        super();
        this.notificationRepo = notificationRepo;
        this.smsProvider = smsProvider;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(NotificationsProcessor_1.name);
    }
    async process(job) {
        const notification = await this.notificationRepo.findOne({
            where: { id: job.data.notificationId },
            relations: ['student', 'student.guardian', 'installment'],
        });
        if (!notification) {
            this.logger.warn(`Notification ${job.data.notificationId} not found, skipping`);
            return;
        }
        const guardianPhone = notification.student.guardian?.phone;
        if (!guardianPhone) {
            this.logger.error(`Student ${notification.student.id} has no guardian phone on file — cannot send SMS`);
            await this.notificationsService.markFailed(notification.id);
            return;
        }
        const text = this.buildMessage(notification);
        const result = await this.smsProvider.send({ to: guardianPhone, text });
        if (result.success) {
            await this.notificationsService.markSent(notification.id);
        }
        else {
            await this.notificationsService.markFailed(notification.id);
            throw new Error('SMS send failed');
        }
    }
    buildMessage(notification) {
        const studentName = notification.student.fullName;
        const amount = Number(notification.installment.amount).toLocaleString('fa-IR');
        switch (notification.type) {
            case notification_entity_1.NotificationType.PAYMENT_RECEIVED:
                return `دانش‌آموز ${studentName}: پرداخت به مبلغ ${amount} تومان با موفقیت ثبت شد.`;
            case notification_entity_1.NotificationType.UPCOMING_DUE:
                return `دانش‌آموز ${studentName}: قسط به مبلغ ${amount} تومان به‌زودی سررسید می‌شود.`;
            case notification_entity_1.NotificationType.OVERDUE_INSTALLMENT:
            default:
                return `دانش‌آموز ${studentName}: قسط به مبلغ ${amount} تومان سررسید شده است.`;
        }
    }
};
exports.NotificationsProcessor = NotificationsProcessor;
exports.NotificationsProcessor = NotificationsProcessor = NotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(notifications_service_1.NOTIFICATIONS_QUEUE),
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        sms_provider_service_1.SmsProviderService,
        notifications_service_1.NotificationsService])
], NotificationsProcessor);
//# sourceMappingURL=notifications.processor.js.map