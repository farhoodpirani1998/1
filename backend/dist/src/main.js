"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const app_logger_service_1 = require("./common/logging/app-logger.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: new app_logger_service_1.AppLogger(),
        bufferLogs: true,
    });
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }
    app.enableShutdownHooks();
    app.use((0, helmet_1.default)());
    const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
    if (isProduction && (!configuredOrigins || configuredOrigins.length === 0)) {
        throw new Error('CORS_ORIGINS must be set to a comma-separated list of allowed origins when NODE_ENV=production');
    }
    app.enableCors({
        origin: configuredOrigins ?? true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map