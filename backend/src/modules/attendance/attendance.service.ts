import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { Student } from '../students/entities/student.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceByDateDto } from './dto/query-attendance-by-date.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
  ) {}

  /**
   * Creates or corrects one student's attendance for one calendar day.
   *
   * Tenant enforcement mirrors StudentsService.create()'s
   * guardianId/academicYearId/gradeId checks: the referenced student is
   * fetched by id alone, then its schoolId is compared to the caller's --
   * NotFound if it doesn't exist at all, Forbidden if it exists but
   * belongs to another school.
   *
   * Upserts on (studentId, date) -- see uq_attendance_student_date in the
   * Attendance migration -- so correcting today's mark is a second POST,
   * not a 409/duplicate row. academicYearId is always derived from the
   * student's own current record, never accepted from the request body,
   * so it can never drift from the student it's attached to.
   */
  async record(
    dto: CreateAttendanceDto,
    schoolId: string,
    recordedById: string,
  ): Promise<Attendance> {
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
    }

    const existing = await this.attendanceRepo.findOne({
      where: { studentId: dto.studentId, date: dto.date },
    });

    if (existing) {
      existing.status = dto.status;
      existing.note = dto.note ?? null;
      existing.recordedById = recordedById;
      return this.attendanceRepo.save(existing);
    }

    const attendance = this.attendanceRepo.create({
      schoolId,
      studentId: dto.studentId,
      academicYearId: student.academicYearId,
      date: dto.date,
      status: dto.status,
      note: dto.note ?? null,
      recordedById,
    });
    return this.attendanceRepo.save(attendance);
  }

  /**
   * Full attendance history for one student, most recent day first.
   * Tenant check follows StudentsService.findOne()'s shape: a single
   * schoolId-scoped existence check, so a wrong-tenant id 404s exactly
   * like a nonexistent one.
   */
  async findByStudent(studentId: string, schoolId: string): Promise<Attendance[]> {
    await this.assertStudentInSchool(studentId, schoolId);
    return this.attendanceRepo.find({
      where: { studentId },
      order: { date: 'DESC' },
    });
  }

  /**
   * Every attendance record for the caller's school on one calendar day,
   * optionally narrowed to one grade and/or academic year -- the
   * "did I take attendance for this class today" roster view.
   */
  async findByDate(
    date: string,
    schoolId: string,
    query: QueryAttendanceByDateDto,
  ): Promise<Attendance[]> {
    if (!DATE_ONLY.test(date)) {
      throw new BadRequestException('فرمت تاریخ نامعتبر است (مورد انتظار: YYYY-MM-DD)');
    }

    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.student', 'student')
      .where('attendance.schoolId = :schoolId', { schoolId })
      .andWhere('attendance.date = :date', { date });

    if (query.gradeId) {
      qb.andWhere('student.gradeId = :gradeId', { gradeId: query.gradeId });
    }
    if (query.academicYearId) {
      qb.andWhere('attendance.academicYearId = :academicYearId', {
        academicYearId: query.academicYearId,
      });
    }

    return qb.orderBy('student.fullName', 'ASC').getMany();
  }

  /**
   * Parent-side access: same "linked child only" rule as every other
   * /parent/students/:id/* route (ParentService.findMyStudent,
   * StudentProfileService.getForParent) -- 404, never 403, so a parent
   * probing an id can't tell "doesn't exist" from "exists but isn't
   * yours". Checked here directly (rather than delegating to
   * ParentService) for the same reason StudentProfileService does its own
   * inline check: AttendanceModule is imported BY ParentModule, so
   * importing ParentModule back here would create a cycle.
   */
  async findForParent(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<Attendance[]> {
    const link = await this.parentStudentRepo.findOne({ where: { parentId, studentId } });
    if (!link) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    return this.findByStudent(studentId, schoolId);
  }

  /**
   * Used only by StudentProfileService to populate the profile's
   * attendance section. The student's tenant/link check has already run
   * in StudentProfileService by the time this is called, so this is a
   * plain, capped read with no NotFound path of its own.
   */
  async findRecentForStudent(studentId: string, limit: number): Promise<Attendance[]> {
    return this.attendanceRepo.find({
      where: { studentId },
      order: { date: 'DESC' },
      take: limit,
    });
  }

  private async assertStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
  }
}
