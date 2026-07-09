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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = exports.NOTIFICATIONS_QUEUE = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("./entities/notification.entity");
exports.NOTIFICATIONS_QUEUE = 'notifications';
let NotificationsService = class NotificationsService {
    constructor(notificationRepo, notificationsQueue) {
        this.notificationRepo = notificationRepo;
        this.notificationsQueue = notificationsQueue;
    }
    async queueOverdueReminder(installmentId, studentId) {
        return this.enqueue({
            studentId,
            installmentId,
            template: notification_entity_1.NotificationTemplate.OVERDUE_REMINDER,
        });
    }
    async queuePaymentConfirmation(installmentId, studentId, amount) {
        return this.enqueue({
            studentId,
            installmentId,
            template: notification_entity_1.NotificationTemplate.PAYMENT_CONFIRMATION,
            context: { amount },
        });
    }
    async queueWelcomeMessage(studentId) {
        return this.enqueue({
            studentId,
            installmentId: null,
            template: notification_entity_1.NotificationTemplate.WELCOME,
        });
    }
    async enqueue(params) {
        const notification = this.notificationRepo.create({
            studentId: params.studentId,
            installmentId: params.installmentId,
            template: params.template,
            channel: 'sms',
            status: notification_entity_1.NotificationStatus.PENDING,
        });
        const saved = await this.notificationRepo.save(notification);
        const jobData = { notificationId: saved.id, context: params.context };
        await this.notificationsQueue.add('send-sms', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });
        return saved;
    }
    async markSent(id) {
        await this.notificationRepo.update(id, {
            status: notification_entity_1.NotificationStatus.SENT,
            sentAt: new Date(),
        });
    }
    async markFailed(id) {
        await this.notificationRepo.update(id, { status: notification_entity_1.NotificationStatus.FAILED });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(1, (0, bullmq_1.InjectQueue)(exports.NOTIFICATIONS_QUEUE)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, typeof (_b = typeof bullmq_2.Queue !== "undefined" && bullmq_2.Queue) === "function" ? _b : Object])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map