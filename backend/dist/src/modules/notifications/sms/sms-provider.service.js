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
var SmsProviderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsProviderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let SmsProviderService = SmsProviderService_1 = class SmsProviderService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(SmsProviderService_1.name);
        this.apiUrl = this.configService.get('SMS_API_URL');
        this.apiKey = this.configService.get('SMS_API_KEY');
        this.senderNumber = this.configService.get('SMS_SENDER_NUMBER');
    }
    async send(message) {
        if (!this.apiUrl || !this.apiKey) {
            this.logger.warn(`SMS_API_URL/SMS_API_KEY not configured — logging instead of sending: to=${message.to} text=${message.text}`);
            return { success: true, providerRef: 'unconfigured-noop' };
        }
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.apiKey,
                },
                body: JSON.stringify(this.buildRequestBody(message)),
            });
            if (!response.ok) {
                const body = await response.text();
                this.logger.error(`SMS gateway responded ${response.status}: ${body}`);
                return { success: false };
            }
            const data = await response.json();
            return { success: true, providerRef: data?.messageId ?? data?.id };
        }
        catch (error) {
            this.logger.error(`SMS gateway request failed: ${error.message}`);
            return { success: false };
        }
    }
    buildRequestBody(message) {
        return {
            sender: this.senderNumber,
            receptor: message.to,
            message: message.text,
        };
    }
};
exports.SmsProviderService = SmsProviderService;
exports.SmsProviderService = SmsProviderService = SmsProviderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SmsProviderService);
//# sourceMappingURL=sms-provider.service.js.map