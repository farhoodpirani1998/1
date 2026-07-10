import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { Guardian } from '../students/entities/guardian.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Homework } from '../homework/entities/homework.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// Phase 5N: Global Search.
//
// Declares its own narrow TypeORM repos for Student/Guardian/User/Subject/
// Homework/Announcement instead of importing StudentsModule/UsersModule/
// HomeworkModule/AnnouncementsModule/StudentAssessmentsModule -- same shape
// HomeworkModule/TimetableModule/StudentDocumentsModule already use to
// avoid an unnecessary cross-module dependency for what is, on each side,
// a single read query. Purely additive: no existing module is imported,
// exported, or modified to wire this in besides the one new entry in
// AppModule's imports array.
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Guardian, User, Subject, Homework, Announcement]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
