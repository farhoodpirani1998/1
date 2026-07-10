import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherAssignment } from './entities/teacher-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { StudentAssessmentsModule } from '../student-assessments/student-assessments.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { TimetableModule } from '../timetable/timetable.module';
import { HomeworkModule } from '../homework/homework.module';

// Phase 5G: Teacher Portal Foundation.
//
// Imports AttendanceModule and StudentAssessmentsModule to reuse
// AttendanceService.record() / AssessmentsService.record() directly --
// TeacherService adds only the "is this teacher assigned to this
// class/subject" gate in front of them, never reimplements their
// tenant checks, upsert-on-resubmit behavior, or academicYearId
// derivation. Declares its own narrow TypeORM repos for User/Student/
// Grade/Subject (the same shape AttendanceModule/StudentAssessmentsModule
// already use for their own student/parent-link reads) rather than
// importing StudentsModule/GradesModule/UsersModule back, since none of
// those need TeacherService and a two-way import isn't needed here.
@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherAssignment, User, Student, Grade, Subject]),
    AttendanceModule,
    StudentAssessmentsModule,
    AnnouncementsModule,
    TimetableModule,
    HomeworkModule,
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
