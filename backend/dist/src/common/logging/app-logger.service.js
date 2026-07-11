"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLogger = void 0;
const pino_1 = __importDefault(require("pino"));
const request_context_1 = require("./request-context");
class AppLogger {
    constructor() {
        const isProduction = process.env.NODE_ENV === 'production';
        const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');
        let transport;
        if (!isProduction) {
            try {
                require.resolve('pino-pretty');
                transport = { target: 'pino-pretty', options: { colorize: true, singleLine: true } };
            }
            catch {
                transport = undefined;
            }
        }
        this.pino = (0, pino_1.default)({
            level,
            ...(transport ? { transport } : {}),
            redact: {
                paths: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    '*.password',
                    '*.passwordHash',
                    '*.token',
                ],
                remove: true,
            },
        });
    }
    log(message, ...optionalParams) {
        this.write('info', message, optionalParams);
    }
    error(message, ...optionalParams) {
        this.write('error', message, optionalParams);
    }
    warn(message, ...optionalParams) {
        this.write('warn', message, optionalParams);
    }
    debug(message, ...optionalParams) {
        this.write('debug', message, optionalParams);
    }
    verbose(message, ...optionalParams) {
        this.write('trace', message, optionalParams);
    }
    fatal(message, ...optionalParams) {
        this.write('fatal', message, optionalParams);
    }
    setLogLevels(levels) {
        void levels;
    }
    write(level, message, optionalParams) {
        const params = [...optionalParams];
        const context = params.length > 0 && typeof params[params.length - 1] === 'string'
            ? params.pop()
            : undefined;
        const trace = params.length > 0 ? params.map(String).join(' ') : undefined;
        const store = (0, request_context_1.getRequestContext)();
        const payload = {
            ...(context ? { context } : {}),
            ...(trace ? { trace } : {}),
            ...(store?.requestId ? { requestId: store.requestId } : {}),
            ...(store?.userId ? { userId: store.userId } : {}),
            ...(store?.schoolId ? { schoolId: store.schoolId } : {}),
        };
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        this.pino[level](payload, msg);
    }
}
exports.AppLogger = AppLogger;
//# sourceMappingURL=app-logger.service.js.map