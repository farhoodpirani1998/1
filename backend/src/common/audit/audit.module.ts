import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditEventsListener } from './audit-events.listener';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, AuditEventsListener],
  // Exported so a future AuditController (e.g. GET /audit-logs) or another
  // module (e.g. the receipt endpoint noting who printed it) can inject it.
  exports: [AuditService],
})
export class AuditModule {}
