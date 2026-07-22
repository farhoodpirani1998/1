import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { NotificationsService, NOTIFICATIONS_QUEUE } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { SmsProviderService } from './sms/sms-provider.service';
import { PaymentEventsListener } from './payment-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      // Sprint 3 Phase 1 — reliability hardening: completed/failed jobs
      // previously stayed in Redis forever (no removeOnComplete/
      // removeOnFail), growing unbounded. This is queue-level cleanup
      // config only — per-job options passed to `.add()` in
      // notifications.service.ts (attempts/backoff) are untouched, and
      // job data itself is unaffected since job outcomes are already
      // persisted to the `notifications` table (see markSent/markFailed)
      // before a job is ever cleaned up.
      defaultJobOptions: {
        // Completed jobs: no ongoing debugging value once sent, so keep
        // a short window (1 day) purely for spot-checking recent activity,
        // capped by count as a hard ceiling independent of traffic volume.
        removeOnComplete: {
          age: 24 * 60 * 60, // 1 day, in seconds
          count: 1000,
        },
        // Failed jobs: kept longer since they're what gets investigated
        // when SMS delivery breaks; 7 days gives a full week to notice
        // and diagnose before Redis reclaims the space.
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days, in seconds
        },
      },
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    SmsProviderService,
    PaymentEventsListener,
  ],
  exports: [NotificationsService, SmsProviderService],
})
export class NotificationsModule {}
