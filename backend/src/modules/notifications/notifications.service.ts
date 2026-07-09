import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus } from './entities/notification.entity';

export const NOTIFICATIONS_QUEUE = 'notifications';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Called by the overdue-installments cron (and can also be called right
   * after an installment is created, for "upcoming due date" reminders).
   * Creates a `pending` notification row, then enqueues a BullMQ job that
   * the processor picks up asynchronously — so the request/cron tick that
   * triggered this never blocks on the actual SMS gateway call.
   */
  async queueOverdueReminder(installmentId: string, studentId: string): Promise<Notification> {
    const notification = this.notificationRepo.create({
      studentId,
      installmentId,
      channel: 'sms',
      status: NotificationStatus.PENDING,
    });
    const saved = await this.notificationRepo.save(notification);

    await this.notificationsQueue.add(
      'send-sms',
      { notificationId: saved.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return saved;
  }

  /**
   * Queues a "payment received" SMS. Called from PaymentEventsListener in
   * reaction to PaymentRecordedEvent — NotificationsService has no idea
   * PaymentsService exists; the event is the only connection between them.
   */
  async queuePaymentReceipt(installmentId: string, studentId: string): Promise<Notification> {
    const notification = this.notificationRepo.create({
      studentId,
      installmentId,
      channel: 'sms',
      status: NotificationStatus.PENDING,
    });
    const saved = await this.notificationRepo.save(notification);

    await this.notificationsQueue.add(
      'send-sms',
      { notificationId: saved.id, template: 'payment-receipt' },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return saved;
  }

  async markSent(id: string): Promise<void> {
    await this.notificationRepo.update(id, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.notificationRepo.update(id, { status: NotificationStatus.FAILED });
  }
}
