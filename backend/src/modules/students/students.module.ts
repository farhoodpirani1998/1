import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { GuardiansService } from './guardians.service';
// Phase 5D: GET /students/:id/profile is served by StudentProfileService.
import { StudentProfileModule } from './profile/student-profile.module';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Guardian]), StudentProfileModule],
  controllers: [StudentsController],
  providers: [StudentsService, GuardiansService],
  exports: [StudentsService, GuardiansService],
})
export class StudentsModule {}
