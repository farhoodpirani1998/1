import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditEventsListener } from './audit-events.listener';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, AuditEventsListener],
  // Exported so another module (e.g. the receipt endpoint noting who
  // printed it) can inject it in the future.
  exports: [AuditService],
})
export class AuditModule {}
