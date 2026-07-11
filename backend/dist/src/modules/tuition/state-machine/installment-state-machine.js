"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallmentStateMachine = void 0;
const common_1 = require("@nestjs/common");
const installment_entity_1 = require("../entities/installment.entity");
const TRANSITIONS = {
    [installment_entity_1.InstallmentStatus.PENDING]: [
        installment_entity_1.InstallmentStatus.PARTIAL,
        installment_entity_1.InstallmentStatus.PAID,
        installment_entity_1.InstallmentStatus.OVERDUE,
        installment_entity_1.InstallmentStatus.CANCELLED,
        installment_entity_1.InstallmentStatus.DEFERRED,
        installment_entity_1.InstallmentStatus.DISPUTED,
    ],
    [installment_entity_1.InstallmentStatus.OVERDUE]: [
        installment_entity_1.InstallmentStatus.PARTIAL,
        installment_entity_1.InstallmentStatus.PAID,
        installment_entity_1.InstallmentStatus.CANCELLED,
        installment_entity_1.InstallmentStatus.DEFERRED,
        installment_entity_1.InstallmentStatus.DISPUTED,
    ],
    [installment_entity_1.InstallmentStatus.PARTIAL]: [
        installment_entity_1.InstallmentStatus.PAID,
        installment_entity_1.InstallmentStatus.OVERDUE,
        installment_entity_1.InstallmentStatus.CANCELLED,
        installment_entity_1.InstallmentStatus.DEFERRED,
        installment_entity_1.InstallmentStatus.DISPUTED,
    ],
    [installment_entity_1.InstallmentStatus.DEFERRED]: [
        installment_entity_1.InstallmentStatus.PENDING,
        installment_entity_1.InstallmentStatus.PARTIAL,
        installment_entity_1.InstallmentStatus.PAID,
        installment_entity_1.InstallmentStatus.CANCELLED,
    ],
    [installment_entity_1.InstallmentStatus.DISPUTED]: [
        installment_entity_1.InstallmentStatus.PENDING,
        installment_entity_1.InstallmentStatus.PARTIAL,
        installment_entity_1.InstallmentStatus.PAID,
        installment_entity_1.InstallmentStatus.CANCELLED,
    ],
    [installment_entity_1.InstallmentStatus.PAID]: [
        installment_entity_1.InstallmentStatus.PARTIAL,
        installment_entity_1.InstallmentStatus.PENDING,
    ],
    [installment_entity_1.InstallmentStatus.CANCELLED]: [],
};
class InstallmentStateMachine {
    static assertTransition(from, to) {
        if (from === to)
            return;
        const allowed = TRANSITIONS[from] ?? [];
        if (!allowed.includes(to)) {
            throw new common_1.BadRequestException(`انتقال وضعیت از «${from}» به «${to}» مجاز نیست`);
        }
    }
    static deriveFromAmounts(paidAmount, totalAmount, dueDate) {
        if (paidAmount >= totalAmount)
            return installment_entity_1.InstallmentStatus.PAID;
        if (paidAmount > 0)
            return installment_entity_1.InstallmentStatus.PARTIAL;
        const isPastDue = new Date(dueDate) < new Date(new Date().toDateString());
        return isPastDue ? installment_entity_1.InstallmentStatus.OVERDUE : installment_entity_1.InstallmentStatus.PENDING;
    }
    static isLiveState(status) {
        return [
            installment_entity_1.InstallmentStatus.PENDING,
            installment_entity_1.InstallmentStatus.PARTIAL,
            installment_entity_1.InstallmentStatus.OVERDUE,
        ].includes(status);
    }
}
exports.InstallmentStateMachine = InstallmentStateMachine;
//# sourceMappingURL=installment-state-machine.js.map