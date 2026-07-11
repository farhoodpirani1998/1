"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAGE_LIMIT = exports.DEFAULT_PAGE_LIMIT = void 0;
exports.normalizePagination = normalizePagination;
exports.DEFAULT_PAGE_LIMIT = 50;
exports.MAX_PAGE_LIMIT = 200;
function normalizePagination(params) {
    const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
    const requestedLimit = params.limit && params.limit > 0 ? Math.floor(params.limit) : exports.DEFAULT_PAGE_LIMIT;
    const limit = Math.min(requestedLimit, exports.MAX_PAGE_LIMIT);
    return { page, limit, skip: (page - 1) * limit };
}
//# sourceMappingURL=pagination.js.map