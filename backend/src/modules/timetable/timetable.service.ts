import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { TimetableEntry } from './entities/timetable-entry.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { Role } from '../../common/authorization/roles.enum';

const ENTRY_RELATIONS = ['grade', 'subject', 'teacher'];

// A fully-resolved set of the five fields an overlap/assignment check
// needs, whether they came from a fresh CreateTimetableEntryDto or from
// an existing row merged with a partial UpdateTimetableEntryDto.
interface ResolvedEntryFields {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

@Injectable()
export class TimetableService {
  constructor(
    @InjectRepository(TimetableEntry)
    private readonly timetableRepo: Repository<TimetableEntry>,
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(TeacherAssignment)
    private readonly assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  // ---------------------------------------------------------------------
  // school_admin-side management
  // ---------------------------------------------------------------------

  /**
   * Creates a new scheduled period. Every referenced id (academicYearId,
   * gradeId, subjectId, teacherId) is fetched by id alone, then its
   * schoolId compared to the caller's -- NotFound if it doesn't exist at
   * all, Forbidden if it exists but belongs to another school, same shape
   * as TeacherService.assign(). The teacher must additionally hold a
   * TeacherAssignment for the exact (gradeId, subjectId) pair -- reusing
   * the same assignment table and the same "assigned or Forbidden" rule
   * TeacherService.recordAssessment() already enforces, rather than
   * re-deriving a separate notion of "who's allowed to teach what".
   */
  async create(dto: CreateTimetableEntryDto, schoolId: string): Promise<TimetableEntry> {
    await this.assertRelationsInSchool(dto, schoolId);
    this.assertTimeRangeValid(dto.startTime, dto.endTime);
    await this.assertAssigned(dto.teacherId, dto.gradeId, dto.subjectId, schoolId);
    await this.assertNoOverlap(dto, schoolId);

    const entry = this.timetableRepo.create({
      schoolId,
      academicYearId: dto.academicYearId,
      gradeId: dto.gradeId,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      room: dto.room ?? null,
    });
    const saved = await this.timetableRepo.save(entry);
    return this.findOneOrThrow(saved.id, schoolId);
  }

  /**
   * school_admin-side listing, optionally narrowed by gradeId / teacherId
   * / academicYearId. Every result is scoped to the caller's own school.
   */
  async findAllForSchool(schoolId: string, query: QueryTimetableDto): Promise<TimetableEntry[]> {
    return this.timetableRepo.find({
      where: {
        schoolId,
        ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      relations: ENTRY_RELATIONS,
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Partial update. Fetches the existing row (404 on a nonexistent or
   * another school's id, same as AnnouncementsService.delete()), merges
   * whichever fields the caller provided onto it, then re-runs the exact
   * same relation/assignment/overlap checks create() runs -- against the
   * *merged* result, and excluding this row's own id from the overlap
   * scan -- so a partial update can never land in a state create() would
   * have rejected outright.
   */
  async update(id: string, dto: UpdateTimetableEntryDto, schoolId: string): Promise<TimetableEntry> {
    const entry = await this.timetableRepo.findOne({ where: { id, schoolId } });
    if (!entry) {
      throw new NotFoundException('این برنامه یافت نشد');
    }

    const merged: ResolvedEntryFields = {
      academicYearId: dto.academicYearId ?? entry.academicYearId,
      gradeId: dto.gradeId ?? entry.gradeId,
      subjectId: dto.subjectId ?? entry.subjectId,
      teacherId: dto.teacherId ?? entry.teacherId,
      weekday: dto.weekday ?? entry.weekday,
      startTime: dto.startTime ?? entry.startTime,
      endTime: dto.endTime ?? entry.endTime,
    };

    await this.assertRelationsInSchool(merged, schoolId);
    this.assertTimeRangeValid(merged.startTime, merged.endTime);
    await this.assertAssigned(merged.teacherId, merged.gradeId, merged.subjectId, schoolId);
    await this.assertNoOverlap(merged, schoolId, id);

    Object.assign(entry, merged, { room: dto.room !== undefined ? dto.room : entry.room });
    await this.timetableRepo.save(entry);
    return this.findOneOrThrow(id, schoolId);
  }

  /**
   * school_admin-only removal. Scoped by (id, schoolId) together, same
   * belt-and-suspenders shape as AnnouncementsService.delete().
   */
  async remove(id: string, schoolId: string): Promise<void> {
    const entry = await this.timetableRepo.findOne({ where: { id, schoolId } });
    if (!entry) {
      throw new NotFoundException('این برنامه یافت نشد');
    }
    await this.timetableRepo.remove(entry);
  }

  // ---------------------------------------------------------------------
  // teacher-side self-service read
  // ---------------------------------------------------------------------

  /**
   * Every scheduled period for the calling teacher, scoped to their own
   * school -- never a school-wide view. Re-scoped to schoolId even though
   * a teacher's own entries can only ever be created within their own
   * school by create() above, same defense-in-depth reasoning
   * TeacherService.getMyAssignments() already documents.
   */
  async findForTeacher(teacherId: string, schoolId: string): Promise<TimetableEntry[]> {
    return this.timetableRepo.find({
      where: { teacherId, schoolId },
      relations: ENTRY_RELATIONS,
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  // ---------------------------------------------------------------------
  // parent-side self-service read
  // ---------------------------------------------------------------------

  /**
   * Parent-side access: same "linked child only" rule as every other
   * /parent/students/:id/* route (ParentService.findMyStudent,
   * StudentDocumentsService.findForParent) -- 404, never 403, so a parent
   * probing an id can't tell "doesn't exist" from "exists but isn't
   * yours". Returns the *grade's* timetable (a student doesn't have one
   * of their own -- they attend whatever's scheduled for their grade),
   * checked here directly rather than delegating to ParentService, for
   * the same reason AssessmentsService/StudentDocumentsService do their
   * own inline check: TimetableModule is imported BY ParentModule, so
   * importing ParentModule back here would create a cycle.
   */
  async findForParent(studentId: string, parentId: string, schoolId: string): Promise<TimetableEntry[]> {
    const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
    if (!link) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    return this.timetableRepo.find({
      where: { gradeId: student.gradeId, schoolId },
      relations: ENTRY_RELATIONS,
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  // ---------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------

  private async findOneOrThrow(id: string, schoolId: string): Promise<TimetableEntry> {
    const entry = await this.timetableRepo.findOne({
      where: { id, schoolId },
      relations: ENTRY_RELATIONS,
    });
    if (!entry) {
      throw new NotFoundException('این برنامه یافت نشد');
    }
    return entry;
  }

  private async assertRelationsInSchool(
    fields: Pick<ResolvedEntryFields, 'academicYearId' | 'gradeId' | 'subjectId' | 'teacherId'>,
    schoolId: string,
  ): Promise<void> {
    const academicYear = await this.academicYearRepo.findOne({ where: { id: fields.academicYearId } });
    if (!academicYear) {
      throw new NotFoundException('سال تحصیلی یافت نشد');
    }
    if (academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
    }

    const grade = await this.gradeRepo.findOne({ where: { id: fields.gradeId } });
    if (!grade) {
      throw new NotFoundException('پایه یافت نشد');
    }
    if (grade.schoolId !== schoolId) {
      throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
    }

    const subject = await this.subjectRepo.findOne({ where: { id: fields.subjectId } });
    if (!subject) {
      throw new NotFoundException('درس یافت نشد');
    }
    if (subject.schoolId !== schoolId) {
      throw new ForbiddenException('این درس متعلق به مدرسه دیگری است');
    }

    const teacher = await this.userRepo.findOne({ where: { id: fields.teacherId } });
    if (!teacher) {
      throw new NotFoundException('معلم یافت نشد');
    }
    if (teacher.role !== Role.TEACHER) {
      throw new BadRequestException('این کاربر نقش معلم ندارد');
    }
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenException('این معلم متعلق به مدرسه دیگری است');
    }
  }

  /** startTime/endTime may come from a fresh DTO ('HH:MM') or from an
   * existing row read back from Postgres ('HH:MM:SS') when only one of
   * the pair is being changed in update() -- normalizing both to the
   * first 5 characters before comparing avoids a lexicographic-length
   * mismatch at exact-boundary times (see rangesOverlap). */
  private assertTimeRangeValid(startTime: string, endTime: string): void {
    if (this.normalizeTime(startTime) >= this.normalizeTime(endTime)) {
      throw new BadRequestException('startTime باید قبل از endTime باشد');
    }
  }

  /**
   * Reuses the same TeacherAssignment table TeacherService.recordAssessment()
   * checks against -- a period can only be scheduled for a teacher who
   * actually holds an assignment for that exact (grade, subject) pair, not
   * just any assignment for the grade (attendance's looser rule doesn't
   * apply here: a timetable slot is inherently subject-specific).
   */
  private async assertAssigned(
    teacherId: string,
    gradeId: string,
    subjectId: string,
    schoolId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { teacherId, gradeId, subjectId, schoolId },
    });
    if (!assignment) {
      throw new ForbiddenException('این معلم برای این پایه و درس تخصیص ندارد');
    }
  }

  /**
   * Rejects (409) a new/updated entry that would overlap another entry
   * for the same teacher, or another entry for the same grade, on the
   * same weekday within the same academic year. Two ranges [s1,e1) and
   * [s2,e2) overlap iff s1 < e2 AND s2 < e1 -- back-to-back periods
   * (one's endTime equal to the next's startTime) are allowed. Scoped to
   * (schoolId, academicYearId, weekday) rather than every academic year
   * ever scheduled: a school only ever runs one academic year's
   * timetable at a time, so entries from a past/future year can never
   * actually collide in real time with the one being created.
   */
  private async assertNoOverlap(
    fields: ResolvedEntryFields,
    schoolId: string,
    excludeId?: string,
  ): Promise<void> {
    const teacherRows = await this.timetableRepo.find({
      where: {
        schoolId,
        academicYearId: fields.academicYearId,
        weekday: fields.weekday,
        teacherId: fields.teacherId,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (teacherRows.some((row) => this.rangesOverlap(row, fields))) {
      throw new ConflictException('این معلم در این بازه زمانی برنامه دیگری دارد');
    }

    const gradeRows = await this.timetableRepo.find({
      where: {
        schoolId,
        academicYearId: fields.academicYearId,
        weekday: fields.weekday,
        gradeId: fields.gradeId,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (gradeRows.some((row) => this.rangesOverlap(row, fields))) {
      throw new ConflictException('این پایه در این بازه زمانی برنامه دیگری دارد');
    }
  }

  private rangesOverlap(
    a: { startTime: string; endTime: string },
    b: { startTime: string; endTime: string },
  ): boolean {
    return (
      this.normalizeTime(a.startTime) < this.normalizeTime(b.endTime) &&
      this.normalizeTime(b.startTime) < this.normalizeTime(a.endTime)
    );
  }

  // Rows fetched back from Postgres report TIME columns as 'HH:MM:SS'
  // while DTO input is always exactly 'HH:MM' (see TIME_PATTERN in
  // create-timetable-entry.dto.ts) -- every comparison in this service
  // goes through this first so a length mismatch never produces a wrong
  // answer at an exact-boundary time.
  private normalizeTime(t: string): string {
    return t.slice(0, 5);
  }
}
