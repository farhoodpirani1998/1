import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Class } from './entities/class.entity';
import { Grade } from '../grades/entities/grade.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Student } from '../students/entities/student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

// Declares its own narrow TypeORM repos for Grade/AcademicYear/Student/
// TeacherAssignment (the same shape GradesModule already uses for its
// own Student repo) rather than importing StudentsModule/TeacherModule
// back -- TeacherModule already depends on this module's Class entity,
// so importing TeacherModule here would create a cycle.
@Module({
  imports: [TypeOrmModule.forFeature([Class, Grade, AcademicYear, Student, TeacherAssignment])],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
