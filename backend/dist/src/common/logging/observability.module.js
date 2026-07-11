"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const http_logger_middleware_1 = require("./http-logger.middleware");
const request_id_middleware_1 = require("./request-id.middleware");
const user_context_interceptor_1 = require("./user-context.interceptor");
let ObservabilityModule = class ObservabilityModule {
    configure(consumer) {
        consumer.apply(request_id_middleware_1.RequestIdMiddleware, http_logger_middleware_1.HttpLoggerMiddleware).forRoutes('*');
    }
};
exports.ObservabilityModule = ObservabilityModule;
exports.ObservabilityModule = ObservabilityModule = __decorate([
    (0, common_1.Module)({
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: user_context_interceptor_1.UserContextInterceptor,
            },
        ],
    })
], ObservabilityModule);
//# sourceMappingURL=observability.module.js.map