"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const notification_entity_1 = require("./entities/notification.entity");
const notifications_service_1 = require("./notifications.service");
const notifications_processor_1 = require("./notifications.processor");
const sms_provider_service_1 = require("./sms/sms-provider.service");
const payment_events_listener_1 = require("./payment-events.listener");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([notification_entity_1.Notification]),
            bullmq_1.BullModule.registerQueue({ name: notifications_service_1.NOTIFICATIONS_QUEUE }),
        ],
        providers: [
            notifications_service_1.NotificationsService,
            notifications_processor_1.NotificationsProcessor,
            sms_provider_service_1.SmsProviderService,
            payment_events_listener_1.PaymentEventsListener,
        ],
        exports: [notifications_service_1.NotificationsService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map