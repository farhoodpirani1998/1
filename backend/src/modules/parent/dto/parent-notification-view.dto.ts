import { Notification, NotificationType } from '../../notifications/entities/notification.entity';

/**
 * Builds the human-readable Persian message shown in the parent's
 * notification list. Deliberately separate from
 * NotificationsProcessor.buildMessage (that one builds the SMS text) —
 * same information, different channel, no reason to couple them; this
 * one always has student/installment already loaded via the query in
 * ParentService, so it doesn't need to handle a missing relation.
 */
function buildMessage(notification: Notification): string {
  const studentName = notification.student.fullName;
  const amount = Number(notification.installment.amount).toLocaleString('fa-IR');

  switch (notification.type) {
    case NotificationType.PAYMENT_RECEIVED:
      return `پرداخت قسط ${studentName} به مبلغ ${amount} تومان با موفقیت ثبت شد.`;
    case NotificationType.UPCOMING_DUE:
      return `قسط ${studentName} به مبلغ ${amount} تومان به‌زودی سررسید می‌شود.`;
    case NotificationType.OVERDUE_INSTALLMENT:
    default:
      return `قسط ${studentName} به مبلغ ${amount} تومان سررسید شده و پرداخت نشده است.`;
  }
}

export interface ParentNotificationView {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  studentId: string;
  studentName: string;
  installmentId: string;
  amount: number;
  dueDate: string;
}

export function toParentNotificationView(notification: Notification): ParentNotificationView {
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
