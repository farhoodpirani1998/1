import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuitionModule } from '../tuition/tuition.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OverdueInstallmentsCron } from './overdue-installments.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TuitionModule, // exports InstallmentsService
    NotificationsModule, // exports NotificationsService
  ],
  providers: [OverdueInstallmentsCron],
})
export class SchedulerModule {}
