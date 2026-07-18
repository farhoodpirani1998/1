import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentsController } from './students.controller';
import { GuardiansController } from './guardians.controller';
import { StudentsService } from './students.service';
import { GuardiansService } from './guardians.service';
// Phase 5D: GET /students/:id/profile is served by StudentProfileService.
import { StudentProfileModule } from './profile/student-profile.module';
// POST /students/:id/parent + GET /students/:id/parents: create-or-link a
// parent-portal login directly from the student record. Needs its own
// User/ParentStudent repos rather than importing ParentModule — ParentModule
// transitively imports StudentsModule already (via StudentProfileModule /
// AttendanceModule / StudentAssessmentsModule / StudentDocumentsModule),
// so importing ParentModule here would create a circular module
// dependency. StudentsService.addParent() duplicates the small idempotent
// "create-or-reuse the link row" shape of ParentService.link() instead.
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Guardian, User, ParentStudent]),
    StudentProfileModule,
  ],
  controllers: [StudentsController, GuardiansController],
  providers: [StudentsService, GuardiansService],
  exports: [StudentsService, GuardiansService],
})
export class StudentsModule {}
