import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './entities/attendance.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

// Deliberately does not import StudentsModule or ParentModule: both need
// AttendanceService (ParentModule directly, for GET
// /parent/students/:id/attendance; StudentsModule indirectly, via
// StudentProfileModule's attendance summary), so importing either back
// here would create a cycle. Declares its own narrow TypeORM repos for
// the student/parent-link reads it needs directly -- same shape
// StudentProfileModule already uses for the same reason.
@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Student, ParentStudent])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
