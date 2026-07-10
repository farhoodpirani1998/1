import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuitionModule } from '../tuition/tuition.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OverdueInstallmentsCron } from './overdue-installments.cron';
import { UpcomingDueInstallmentsCron } from './upcoming-due-installments.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TuitionModule, // exports InstallmentsService
    // Phase 5C: UpcomingDueInstallmentsCron calls NotificationsService
    // directly (see that file for why — no status-change event exists to
    // hook for "approaching due date"), so, unlike OverdueInstallmentsCron,
    // this module needs NotificationsModule imported for real.
    NotificationsModule,
  ],
  providers: [OverdueInstallmentsCron, UpcomingDueInstallmentsCron],
})
export class SchedulerModule {}
