import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TuitionModule } from '../tuition/tuition.module';
import { OverdueInstallmentsCron } from './overdue-installments.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TuitionModule, // exports InstallmentsService
    // NotificationsModule is not imported here anymore — the cron no
    // longer calls it directly. NotificationsModule is registered once in
    // AppModule, which is enough for its PaymentEventsListener to receive
    // events emitted from anywhere (EventEmitter2 is process-wide).
  ],
  providers: [OverdueInstallmentsCron],
})
export class SchedulerModule {}
