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
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    SmsProviderService,
    PaymentEventsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
