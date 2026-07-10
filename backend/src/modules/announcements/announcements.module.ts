import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

// Phase 5H: School Announcements.
//
// Exports AnnouncementsService so TeacherModule / ParentModule can each
// import it directly and expose their own read-only, audience-scoped
// route (GET /teacher/announcements, GET /parent/announcements) without
// this module needing to know either of them exists -- same one-way
// import shape AttendanceModule / StudentAssessmentsModule already use
// from ParentModule and TeacherModule.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement])],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
