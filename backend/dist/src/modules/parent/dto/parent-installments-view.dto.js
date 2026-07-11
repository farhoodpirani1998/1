"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentInstallmentViewDto = void 0;
exports.toParentInstallmentView = toParentInstallmentView;
class ParentInstallmentViewDto {
}
exports.ParentInstallmentViewDto = ParentInstallmentViewDto;
function toParentInstallmentView(installment) {
    const paidAmount = Number(installment.paidAmount);
    const amount = Number(installment.amount);
    const remainingAmount = Math.max(0, amount - paidAmount);
    return {
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        amount,
        paidAmount,
        remainingAmount,
        status: installment.status,
        dueDate: installment.dueDate,
    };
}
//# sourceMappingURL=parent-installments-view.dto.js.map