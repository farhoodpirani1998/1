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
var PaymentEventsListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentEventsListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const notifications_service_1 = require("./notifications.service");
const domain_events_1 = require("../../common/events/domain-events");
let PaymentEventsListener = PaymentEventsListener_1 = class PaymentEventsListener {
    constructor(notifications) {
        this.notifications = notifications;
        this.logger = new common_1.Logger(PaymentEventsListener_1.name);
    }
    async onPaymentRecorded(event) {
        if (event.wasIdempotentReplay)
            return;
        try {
            await this.notifications.queuePaymentReceipt(event.installmentId, event.studentId);
        }
        catch (err) {
            this.logger.error(`Failed to queue payment receipt for payment ${event.paymentId}`, err);
        }
    }
    async onInstallmentStatusChanged(event) {
        if (event.toStatus === 'overdue') {
            try {
                await this.notifications.queueOverdueReminder(event.installmentId, event.studentId);
            }
            catch (err) {
                this.logger.error(`Failed to queue overdue reminder for installment ${event.installmentId}`, err);
            }
        }
    }
};
exports.PaymentEventsListener = PaymentEventsListener;
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.PAYMENT_RECORDED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.PaymentRecordedEvent]),
    __metadata("design:returntype", Promise)
], PaymentEventsListener.prototype, "onPaymentRecorded", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.InstallmentStatusChangedEvent]),
    __metadata("design:returntype", Promise)
], PaymentEventsListener.prototype, "onInstallmentStatusChanged", null);
exports.PaymentEventsListener = PaymentEventsListener = PaymentEventsListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], PaymentEventsListener);
//# sourceMappingURL=payment-events.listener.js.map