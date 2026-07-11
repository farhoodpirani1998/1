"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentPaymentViewDto = void 0;
exports.toParentPaymentView = toParentPaymentView;
class ParentPaymentViewDto {
}
exports.ParentPaymentViewDto = ParentPaymentViewDto;
function toParentPaymentView(payment) {
    return {
        id: payment.id,
        installmentId: payment.installmentId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod ?? null,
        paidAt: payment.paidAt,
        receiptNumber: payment.receiptNumber,
    };
}
//# sourceMappingURL=parent-payments-view.dto.js.map