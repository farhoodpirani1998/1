"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toParentNotificationView = toParentNotificationView;
const notification_entity_1 = require("../../notifications/entities/notification.entity");
function buildMessage(notification) {
    const studentName = notification.student.fullName;
    const amount = Number(notification.installment.amount).toLocaleString('fa-IR');
    switch (notification.type) {
        case notification_entity_1.NotificationType.PAYMENT_RECEIVED:
            return `پرداخت قسط ${studentName} به مبلغ ${amount} تومان با موفقیت ثبت شد.`;
        case notification_entity_1.NotificationType.UPCOMING_DUE:
            return `قسط ${studentName} به مبلغ ${amount} تومان به‌زودی سررسید می‌شود.`;
        case notification_entity_1.NotificationType.OVERDUE_INSTALLMENT:
        default:
            return `قسط ${studentName} به مبلغ ${amount} تومان سررسید شده و پرداخت نشده است.`;
    }
}
function toParentNotificationView(notification) {
    return {
        id: notification.id,
        type: notification.type,
        message: buildMessage(notification),
        isRead: notification.readAt !== null,
        readAt: notification.readAt ? notification.readAt.toISOString() : null,
        createdAt: notification.createdAt.toISOString(),
        studentId: notification.studentId,
        studentName: notification.student.fullName,
        installmentId: notification.installmentId,
        amount: Number(notification.installment.amount),
        dueDate: notification.installment.dueDate,
    };
}
//# sourceMappingURL=parent-notification-view.dto.js.map