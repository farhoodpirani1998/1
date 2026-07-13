import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TeacherAssignment } from './entities/teacher-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Assessment } from '../student-assessments/entities/assessment.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { QueryTeacherStudentsDto } from './dto/query-teacher-students.dto';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { CreateAssessmentDto } from '../student-assessments/dto/create-assessment.dto';
import { AttendanceService } from '../attendance/attendance.service';
import { AssessmentsService } from '../student-assessments/assessments.service';
import { Role } from '../../common/authorization/roles.enum';

// Sprint 2B: 'teacher' added alongside 'grade'/'subject' so
// toTeacherAssignmentView can populate teacherName as well as
// gradeTitle/subjectTitle. Used by both assign() and listAssignments()
// below -- every admin-facing assignment read now carries all three
// relations, never just grade/subject.
const ASSIGNMENT_RELATIONS = ['teacher', 'grade', 'subject'];

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherAssignment)
    private readonly assignmentRepo: Repository<TeacherAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    // AttendanceService/AssessmentsService already own every tenant check
    // and the upsert-on-resubmit business logic for their respective
    // tables -- this module only adds the extra "is this teacher actually
    // assigned to this class/subject" gate in front of them, never
    // reimplements what they already do (see recordAttendance /
    // recordAssessment below).
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  // ---------------------------------------------------------------------
  // school_admin-side assignment management
  // ---------------------------------------------------------------------

  /**
   * Assigns a teacher to a grade+subject. Tenant enforcement mirrors
   * ParentService.link()'s shape: teacherId/gradeId/subjectId are each
   * fetched by id alone, then their schoolId compared to the caller's --
   * NotFound if a row doesn't exist at all, Forbidden if it exists but
   * belongs to another school. Idempotent: assigning the same
   * (teacher, grade, subject) triple twice returns the existing row
   * instead of erroring or duplicating, same shape as
   * ParentService.link().
   */
  async assign(dto: CreateTeacherAssignmentDto, schoolId: string): Promise<TeacherAssignment> {
    const teacher = await this.userRepo.findOne({ where: { id: dto.teacherId } });
    if (!teacher) {
      throw new NotFoundException('معلم یافت نشد');
    }
    if (teacher.role !== Role.TEACHER) {
      throw new BadRequestException('این کاربر نقش معلم ندارد');
    }
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenException('این معلم متعلق به مدرسه دیگری است');
    }

    const grade = await this.gradeRepo.findOne({ where: { id: dto.gradeId } });
    if (!grade) {
      throw new NotFoundException('پایه یافت نشد');
    }
    if (grade.schoolId !== schoolId) {
      throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
    }

    const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
    if (!subject) {
      throw new NotFoundException('درس یافت نشد');
    }
    if (subject.schoolId !== schoolId) {
      throw new ForbiddenException('این درس متعلق به مدرسه دیگری است');
    }

    const existing = await this.assignmentRepo.findOne({
      where: { teacherId: dto.teacherId, gradeId: dto.gradeId, subjectId: dto.subjectId },
      relations: ASSIGNMENT_RELATIONS,
    });
    if (existing) {
      return existing;
    }

    const assignment = this.assignmentRepo.create({
      schoolId,
      teacherId: dto.teacherId,
      gradeId: dto.gradeId,
      subjectId: dto.subjectId,
    });
    const saved = await this.assignmentRepo.save(assignment);
    // save() only returns the columns TypeORM just wrote, not the
    // relations -- reload once with ASSIGNMENT_RELATIONS so the response
    // carries teacherName/gradeTitle/subjectTitle the same as the
    // `existing` branch above and listAssignments() below.
    return (await this.assignmentRepo.findOne({
      where: { id: saved.id },
      relations: ASSIGNMENT_RELATIONS,
    })) as TeacherAssignment;
  }

  /**
   * school_admin-side listing, optionally narrowed to one teacher --
   * used to review/manage a teacher's assignments.
   */
  async listAssignments(schoolId: string, teacherId?: string): Promise<TeacherAssignment[]> {
    return this.assignmentRepo.find({
      where: teacherId ? { schoolId, teacherId } : { schoolId },
      relations: ASSIGNMENT_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Sprint 2B: school_admin-facing roster of this school's teacher-role
   * users, for the assignment picker on TeacherAssignmentsPage. There is
   * no equivalent on UsersController (GET /users is @Roles('super_admin')
   * only and isn't school-scoped), so this stays here rather than being
   * bolted onto that module -- same "dedicated portal controller reads
   * its own narrow slice" reasoning as the rest of this service.
   */
  async listTeachers(schoolId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { schoolId, role: Role.TEACHER },
      order: { fullName: 'ASC' },
    });
  }

  /**
   * school_admin-only removal. Scoped by schoolId directly on the row
   * (stored at assignment time -- see the migration), same
   * belt-and-suspenders shape as ParentService.unlink().
   */
  async unassign(id: string, schoolId: string): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({ where: { id, schoolId } });
    if (!assignment) {
      throw new NotFoundException('این تخصیص یافت نشد');
    }
    await this.assignmentRepo.delete(id);
  }

  // ---------------------------------------------------------------------
  // teacher-side self-service reads
  // ---------------------------------------------------------------------

  /**
   * Every assignment row for the calling teacher -- the single source of
   * truth every other teacher-facing method below narrows from. Always
   * re-scoped to schoolId even though a teacher's own assignments can
   * only ever be created within their own school by assign() above --
   * defense in depth, same reasoning ParentService.findMyStudents()
   * re-checks student.schoolId against the parent's own JWT schoolId.
   */
  async getMyAssignments(teacherId: string, schoolId: string): Promise<TeacherAssignment[]> {
    return this.assignmentRepo.find({
      where: { teacherId, schoolId },
      relations: ASSIGNMENT_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * The teacher's own account (fullName/phone/isActive aren't in the JWT
   * payload -- see JwtStrategy -- so this is a real read, not just a
   * reshape of req.user) plus their assignment summary. Re-scoped to
   * schoolId for the same defense-in-depth reason as everything else in
   * this section.
   */
  async getProfile(
    teacherId: string,
    schoolId: string,
  ): Promise<{ user: User; assignments: TeacherAssignment[] }> {
    const user = await this.userRepo.findOne({ where: { id: teacherId, schoolId } });
    if (!user) {
      throw new NotFoundException('معلم یافت نشد');
    }
    const assignments = await this.getMyAssignments(teacherId, schoolId);
    return { user, assignments };
  }

  async getMyClasses(teacherId: string, schoolId: string): Promise<Grade[]> {
    const assignments = await this.getMyAssignments(teacherId, schoolId);
    return this.uniqueByGrade(assignments).map((a) => a.grade);
  }

  async getMySubjects(teacherId: string, schoolId: string): Promise<Subject[]> {
    const assignments = await this.getMyAssignments(teacherId, schoolId);
    const seen = new Set<string>();
    const subjects: Subject[] = [];
    for (const a of assignments) {
      if (!seen.has(a.subjectId)) {
        seen.add(a.subjectId);
        subjects.push(a.subject);
      }
    }
    return subjects;
  }

  /**
   * Every student in one of the teacher's assigned grades (all of them,
   * or one -- see QueryTeacherStudentsDto). A gradeId filter that isn't
   * one of the teacher's own assignments is rejected the same way an
   * out-of-tenant id is rejected elsewhere in the app (Forbidden), never
   * silently returning an empty list that could be mistaken for "this
   * class has no students".
   */
  async getMyStudents(
    teacherId: string,
    schoolId: string,
    query: QueryTeacherStudentsDto,
  ): Promise<Student[]> {
    const assignedGradeIds = await this.assignedGradeIds(teacherId, schoolId);

    let gradeIds = assignedGradeIds;
    if (query.gradeId) {
      if (!assignedGradeIds.includes(query.gradeId)) {
        throw new ForbiddenException('شما به این کلاس دسترسی ندارید');
      }
      gradeIds = [query.gradeId];
    }

    if (gradeIds.length === 0) {
      return [];
    }

    return this.studentRepo.find({
      where: { schoolId, gradeId: In(gradeIds) },
      relations: ['grade'],
      order: { fullName: 'ASC' },
    });
  }

  // ---------------------------------------------------------------------
  // teacher-side scoped writes -- delegate all business logic to the
  // existing services, only adding the assignment gate in front
  // ---------------------------------------------------------------------

  /**
   * Attendance has no subject of its own (see Attendance entity), so a
   * teacher may take attendance for any student in any grade they're
   * assigned to, regardless of which subject that assignment is for --
   * matches how attendance is recorded in every other role (per class,
   * not per subject).
   */
  async recordAttendance(
    dto: CreateAttendanceDto,
    teacherId: string,
    schoolId: string,
  ): Promise<Attendance> {
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    const assignedGradeIds = await this.assignedGradeIds(teacherId, schoolId);
    if (!assignedGradeIds.includes(student.gradeId)) {
      throw new ForbiddenException('شما به کلاس این دانش‌آموز دسترسی ندارید');
    }

    // AttendanceService.record() re-derives academicYearId from the
    // student itself and re-checks student.schoolId === schoolId, so the
    // tenant check here is only the extra assignment gate, not a
    // duplicate of what AttendanceService already guarantees.
    return this.attendanceService.record(dto, schoolId, teacherId);
  }

  /**
   * Assessments are per-subject, so the teacher must hold the exact
   * (grade, subject) assignment matching the student's current grade and
   * the subject in the request body -- not just any assignment for that
   * grade like attendance above.
   */
  async recordAssessment(
    dto: CreateAssessmentDto,
    teacherId: string,
    schoolId: string,
  ): Promise<Assessment> {
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { teacherId, schoolId, gradeId: student.gradeId, subjectId: dto.subjectId },
    });
    if (!assignment) {
      throw new ForbiddenException('شما برای این کلاس و درس تخصیص ندارید');
    }

    // AssessmentsService.record() re-derives academicYearId from the
    // student itself and re-checks student/subject schoolId, so the
    // check above is only the extra assignment gate, not a duplicate of
    // what AssessmentsService already guarantees.
    return this.assessmentsService.record(dto, schoolId, teacherId);
  }

  // ---------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------

  private uniqueByGrade(assignments: TeacherAssignment[]): TeacherAssignment[] {
    const seen = new Set<string>();
    const result: TeacherAssignment[] = [];
    for (const a of assignments) {
      if (!seen.has(a.gradeId)) {
        seen.add(a.gradeId);
        result.push(a);
      }
    }
    return result;
  }

  private async assignedGradeIds(teacherId: string, schoolId: string): Promise<string[]> {
    const assignments = await this.assignmentRepo.find({
      where: { teacherId, schoolId },
    });
    return [...new Set(assignments.map((a) => a.gradeId))];
  }
}
