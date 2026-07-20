import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
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
//
// Sprint A.4: AnnouncementRead is registered here (not a separate
// module) and read exclusively through AnnouncementsService -- same "one
// module owns the whole Announcements surface, read tracking included"
// reasoning as HomeworkModule owning both Homework and
// HomeworkSubmission. No new messaging system/module is introduced;
// this only adds a read-receipt table alongside the existing one.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement, AnnouncementRead])],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
