import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolSettings } from './entities/school-settings.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolSettingsController } from './school-settings.controller';
import { SchoolSettingsService } from './school-settings.service';

// Phase 5M: School Settings.
//
// Declares its own narrow TypeORM repo for School (rather than importing
// SchoolsModule) purely to seed sensible defaults on first creation of a
// school's settings row -- same "narrow repo for a read-only lookup, not
// the whole module" shape TimetableModule/HomeworkModule already use for
// their own cross-module reads.
@Module({
  imports: [TypeOrmModule.forFeature([SchoolSettings, School])],
  controllers: [SchoolSettingsController],
  providers: [SchoolSettingsService],
  exports: [SchoolSettingsService],
})
export class SchoolSettingsModule {}
