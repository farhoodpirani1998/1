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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisHealthIndicator = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const ioredis_1 = __importDefault(require("ioredis"));
const DEFAULT_TIMEOUT_MS = 2000;
let RedisHealthIndicator = class RedisHealthIndicator {
    constructor() {
        this.client = new ioredis_1.default({
            host: process.env.REDIS_HOST ?? 'localhost',
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
        });
        this.client.on('error', () => undefined);
    }
    async pingCheck(key, timeoutMs = DEFAULT_TIMEOUT_MS) {
        try {
            if (this.client.status === 'end' || this.client.status === 'wait') {
                await this.client.connect();
            }
            const pong = await Promise.race([
                this.client.ping(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs);
                }),
            ]);
            if (pong !== 'PONG') {
                throw new Error(`Unexpected Redis PING response: ${String(pong)}`);
            }
            return { [key]: { status: 'up' } };
        }
        catch (error) {
            throw new terminus_1.HealthCheckError('Redis check failed', {
                [key]: {
                    status: 'down',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
    }
    async onModuleDestroy() {
        this.client.disconnect();
    }
};
exports.RedisHealthIndicator = RedisHealthIndicator;
exports.RedisHealthIndicator = RedisHealthIndicator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisHealthIndicator);
//# sourceMappingURL=redis-health.indicator.js.map