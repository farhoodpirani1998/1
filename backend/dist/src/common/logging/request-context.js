"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextStorage = void 0;
exports.getRequestContext = getRequestContext;
const async_hooks_1 = require("async_hooks");
exports.requestContextStorage = new async_hooks_1.AsyncLocalStorage();
function getRequestContext() {
    return exports.requestContextStorage.getStore();
}
//# sourceMappingURL=request-context.js.map