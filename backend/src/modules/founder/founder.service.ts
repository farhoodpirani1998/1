import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FounderSchool } from './entities/founder-school.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { Role } from '../../common/authorization/roles.enum';
import { LinkFounderSchoolDto } from './dto/link-founder-school.dto';
import { QueryStudentsDto } from '../students/dto/query-students.dto';
import { GetDashboardQueryDto } from '../analytics/dto/get-dashboard-query.dto';
import { StudentsService } from '../students/students.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReportsService } from '../reports/reports.service';
import {
  toFounderStaffMemberView,
  FounderStaffMemberView,
} from './dto/founder-staff-view.dto';
import {
  toFounderTeacherView,
  FounderTeacherView,
  toFounderTeacherWithSchoolView,
  FounderTeacherWithSchoolView,
} from './dto/founder-teacher-view.dto';
import { FounderOverviewView, FounderSchoolBreakdown } from './dto/founder-overview-view.dto';
import { FounderTuitionOverview } from './dto/founder-tuition-view.dto';
import {
  normalizePagination,
  wantsPaginatedResponse,
  type PaginationParams,
  type PaginatedResult,
} from '../../common/utils/pagination';

// Roles that count as "staff/employees" for the founder's staff
// directory — every non-teaching, school-facing login. PARENT/TEACHER
// are deliberately excluded: parents aren't employees, and teachers get
// their own dedicated endpoint (with assignment info parents/staff don't
// have).
const STAFF_ROLES = [Role.SCHOOL_ADMIN, Role.ACCOUNTANT, Role.STAFF];

/**
 * Phase 5O: Founder (مؤسس) Portal.
 *
 * A founder owns one or more schools (see FounderSchool /
 * founder_schools) and gets a read-only view across all of them — school
 * list, aggregated + per-school dashboards, student/teacher/staff
 * directories, and tuition summaries. Every method that takes a
 * `schoolId` calls assertOwnsSchool() first, the same "404, not 403, on
 * a school you don't own" shape tenant isolation already uses elsewhere
 * (see StudentsService.findOne / tenant-isolation.e2e-spec) — a founder
 * guessing another owner's school UUID learns nothing about whether it
 * exists.
 *
 * Reuses existing services wherever one already computes the number
 * needed (StudentsService.findWithFilters, AnalyticsService.getDashboard,
 * ReportsService.overdueSummary/debtorStudents) instead of re-deriving
 * business rules here — same reuse convention AnalyticsService itself
 * documents. Declares its own narrow repos (School/User/TeacherAssignment/
 * TuitionPlan/Installment) only for the reads no existing method already
 * returns (school-list, teacher/staff directories, cross-school finance
 * totals).
 */
@Injectable()
export class FounderService {
  constructor(
    @InjectRepository(FounderSchool)
    private readonly founderSchoolRepo: Repository<FounderSchool>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(TeacherAssignment)
    private readonly teacherAssignmentRepo: Repository<TeacherAssignment>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    private readonly studentsService: StudentsService,
    private readonly analyticsService: AnalyticsService,
    private readonly reportsService: ReportsService,
  ) {}

  // -------------------------------------------------------------------
  // Ownership
  // -------------------------------------------------------------------

  private async getOwnedSchoolIds(founderId: string): Promise<string[]> {
    const links = await this.founderSchoolRepo.find({ where: { founderId } });
    return links.map((l) => l.schoolId);
  }

  /** Same 404-on-unowned shape as every other tenant-isolation check in this codebase. */
  private async assertOwnsSchool(founderId: string, schoolId: string): Promise<School> {
    const link = await this.founderSchoolRepo.findOne({ where: { founderId, schoolId } });
    if (!link) {
      throw new NotFoundException('مدرسه یافت نشد');
    }
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException('مدرسه یافت نشد');
    }
    return school;
  }

  // -------------------------------------------------------------------
  // Schools
  // -------------------------------------------------------------------

  async findMySchools(founderId: string): Promise<School[]> {
    const schoolIds = await this.getOwnedSchoolIds(founderId);
    if (schoolIds.length === 0) return [];
    return this.schoolRepo.find({ where: { id: In(schoolIds) }, order: { name: 'ASC' } });
  }

  // -------------------------------------------------------------------
  // Per-school dashboard (delegates to AnalyticsService wholesale)
  // -------------------------------------------------------------------

  async getSchoolDashboard(founderId: string, schoolId: string, query: GetDashboardQueryDto) {
    await this.assertOwnsSchool(founderId, schoolId);
    return this.analyticsService.getDashboard(schoolId, query);
  }

  // -------------------------------------------------------------------
  // Students (delegates to StudentsService wholesale)
  // -------------------------------------------------------------------

  async getStudents(founderId: string, schoolId: string, query: QueryStudentsDto) {
    await this.assertOwnsSchool(founderId, schoolId);
    return this.studentsService.findWithFilters(query, schoolId);
  }

  // -------------------------------------------------------------------
  // Teachers
  // -------------------------------------------------------------------

  async getTeachers(founderId: string, schoolId: string): Promise<FounderTeacherView[]> {
    await this.assertOwnsSchool(founderId, schoolId);

    const teachers = await this.userRepo.find({
      where: { schoolId, role: Role.TEACHER },
      order: { fullName: 'ASC' },
    });
    if (teachers.length === 0) return [];

    const assignments = await this.teacherAssignmentRepo.find({
      where: { schoolId, teacherId: In(teachers.map((t) => t.id)) },
      relations: ['grade', 'subject'],
    });
    const assignmentsByTeacher = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const list = assignmentsByTeacher.get(a.teacherId) ?? [];
      list.push(a);
      assignmentsByTeacher.set(a.teacherId, list);
    }

    return teachers.map((teacher) =>
      toFounderTeacherView(
        teacher,
        (assignmentsByTeacher.get(teacher.id) ?? []).map((a) => ({
          gradeId: a.gradeId,
          gradeTitle: a.grade?.title ?? '',
          subjectId: a.subjectId,
          subjectTitle: a.subjectId ? a.subject?.title ?? '' : 'همه دروس',
        })),
      ),
    );
  }

  // GET /founder/teachers — every teacher across every school this
  // founder owns, tagged with schoolId/schoolName so the frontend can
  // group by school. Same "one query for the users, one for their
  // assignments, join in memory" shape as getTeachers() above, just
  // widened from a single schoolId to In(schoolIds); no assertOwnsSchool
  // call needed since getOwnedSchoolIds() already is the full set of
  // schools this founder may see.
  async getAllTeachers(
    founderId: string,
    pagination: PaginationParams = {},
  ): Promise<FounderTeacherWithSchoolView[] | PaginatedResult<FounderTeacherWithSchoolView>> {
    const paginated = wantsPaginatedResponse(pagination);
    const { page, limit, skip } = normalizePagination(pagination);

    const schoolIds = await this.getOwnedSchoolIds(founderId);
    if (schoolIds.length === 0) {
      return paginated ? { data: [], total: 0, page, limit } : [];
    }

    const schools = await this.schoolRepo.find({ where: { id: In(schoolIds) } });
    const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));

    // Pagination happens here, at teacher retrieval -- not after
    // building the full view array. Assignments below are then only
    // ever fetched for these (already paginated) teacher ids via the
    // existing `In(teachers.map(...))` filter, so a large cross-school
    // teacher roster never pulls every teacher's assignments into
    // memory just to slice a page off the end.
    const teacherWhere = { schoolId: In(schoolIds), role: Role.TEACHER };
    const [teachers, total]: [User[], number] = paginated
      ? await this.userRepo.findAndCount({
          where: teacherWhere,
          order: { fullName: 'ASC' },
          skip,
          take: limit,
        })
      : [await this.userRepo.find({ where: teacherWhere, order: { fullName: 'ASC' } }), 0];

    if (teachers.length === 0) {
      return paginated ? { data: [], total, page, limit } : [];
    }

    const assignments = await this.teacherAssignmentRepo.find({
      where: { schoolId: In(schoolIds), teacherId: In(teachers.map((t) => t.id)) },
      relations: ['grade', 'subject'],
    });
    const assignmentsByTeacher = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const list = assignmentsByTeacher.get(a.teacherId) ?? [];
      list.push(a);
      assignmentsByTeacher.set(a.teacherId, list);
    }

    const views = teachers.map((teacher) =>
      toFounderTeacherWithSchoolView(
        teacher,
        (assignmentsByTeacher.get(teacher.id) ?? []).map((a) => ({
          gradeId: a.gradeId,
          gradeTitle: a.grade?.title ?? '',
          subjectId: a.subjectId,
          subjectTitle: a.subjectId ? a.subject?.title ?? '' : 'همه دروس',
        })),
        teacher.schoolId!,
        schoolNameById.get(teacher.schoolId!) ?? '',
      ),
    );

    return paginated ? { data: views, total, page, limit } : views;
  }

  // -------------------------------------------------------------------
  // Staff (school_admin / accountant / staff — non-teaching employees)
  // -------------------------------------------------------------------

  async getStaff(founderId: string, schoolId: string): Promise<FounderStaffMemberView[]> {
    await this.assertOwnsSchool(founderId, schoolId);
    const staff = await this.userRepo.find({
      where: { schoolId, role: In(STAFF_ROLES) },
      order: { fullName: 'ASC' },
    });
    return staff.map(toFounderStaffMemberView);
  }

  // -------------------------------------------------------------------
  // Tuition (per school)
  // -------------------------------------------------------------------

  async getTuitionOverview(founderId: string, schoolId: string): Promise<FounderTuitionOverview> {
    await this.assertOwnsSchool(founderId, schoolId);
    const { totalTuition, totalPaid } = await this.getFinanceTotals(schoolId);
    const [overdue, topDebtors] = await Promise.all([
      this.reportsService.overdueSummary(schoolId),
      this.reportsService.debtorStudents(schoolId, 10),
    ]);
    return {
      totalTuition,
      totalPaid,
      totalUnpaid: totalTuition - totalPaid,
      overdue,
      topDebtors,
    };
  }

  // Same additive definition ReportsService.studentStatement() / Analytics
  // Service.getFinanceSummary() use per student, aggregated across one
  // school's students in one query.
  private async getFinanceTotals(schoolId: string): Promise<{ totalTuition: number; totalPaid: number }> {
    const [tuitionRaw, paidRaw] = await Promise.all([
      this.tuitionPlanRepo
        .createQueryBuilder('plan')
        .innerJoin('plan.student', 'student')
        .where('student.schoolId = :schoolId', { schoolId })
        .select('COALESCE(SUM(plan.finalAmount), 0)', 'totalTuition')
        .getRawOne<{ totalTuition: string }>(),
      this.installmentRepo
        .createQueryBuilder('installment')
        .innerJoin('installment.tuitionPlan', 'plan')
        .innerJoin('plan.student', 'student')
        .where('student.schoolId = :schoolId', { schoolId })
        .select('COALESCE(SUM(installment.paidAmount), 0)', 'totalPaid')
        .getRawOne<{ totalPaid: string }>(),
    ]);
    return {
      totalTuition: Number(tuitionRaw?.totalTuition ?? 0),
      totalPaid: Number(paidRaw?.totalPaid ?? 0),
    };
  }

  // -------------------------------------------------------------------
  // Cross-school overview — one row per owned school, plus totals
  // -------------------------------------------------------------------

  async getOverview(founderId: string): Promise<FounderOverviewView> {
    const schools = await this.findMySchools(founderId);

    const breakdown: FounderSchoolBreakdown[] = await Promise.all(
      schools.map(async (school) => {
        const [studentCount, teacherCount, staffCount, finance, overdue] = await Promise.all([
          this.countStudents(school.id),
          this.userRepo.count({ where: { schoolId: school.id, role: Role.TEACHER } }),
          this.userRepo.count({ where: { schoolId: school.id, role: In(STAFF_ROLES) } }),
          this.getFinanceTotals(school.id),
          this.reportsService.overdueSummary(school.id),
        ]);
        return {
          schoolId: school.id,
          schoolName: school.name,
          isActive: school.isActive,
          studentCount,
          teacherCount,
          staffCount,
          totalTuition: finance.totalTuition,
          totalPaid: finance.totalPaid,
          totalUnpaid: finance.totalTuition - finance.totalPaid,
          overdueAmount: overdue.totalOverdueAmount,
        };
      }),
    );

    const totals = breakdown.reduce(
      (acc, s) => ({
        schoolCount: acc.schoolCount + 1,
        studentCount: acc.studentCount + s.studentCount,
        teacherCount: acc.teacherCount + s.teacherCount,
        staffCount: acc.staffCount + s.staffCount,
        totalTuition: acc.totalTuition + s.totalTuition,
        totalPaid: acc.totalPaid + s.totalPaid,
        totalUnpaid: acc.totalUnpaid + s.totalUnpaid,
        overdueAmount: acc.overdueAmount + s.overdueAmount,
      }),
      {
        schoolCount: 0,
        studentCount: 0,
        teacherCount: 0,
        staffCount: 0,
        totalTuition: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        overdueAmount: 0,
      },
    );

    return { totals, schools: breakdown, generatedAt: new Date() };
  }

  // Kept as its own tiny helper (rather than inlined) so it reads the
  // same "one metric per line" way as the Promise.all above it. Same
  // repo.count({ where: { schoolId } }) shape AnalyticsService.
  // getStudentsSummary() uses — TypeORM's default find/count already
  // excludes soft-deleted rows (Student.deletedAt), so a withdrawn/
  // removed student never inflates this.
  private async countStudents(schoolId: string): Promise<number> {
    return this.studentRepo.count({ where: { schoolId } });
  }

  // -------------------------------------------------------------------
  // Link management (super_admin only)
  // -------------------------------------------------------------------

  async link(dto: LinkFounderSchoolDto): Promise<FounderSchool> {
    const founder = await this.userRepo.findOne({ where: { id: dto.founderId } });
    if (!founder) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    if (founder.role !== Role.FOUNDER) {
      throw new BadRequestException('این کاربر نقش مؤسس ندارد');
    }

    const school = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
    if (!school) {
      throw new NotFoundException('مدرسه یافت نشد');
    }

    const existing = await this.founderSchoolRepo.findOne({
      where: { founderId: dto.founderId, schoolId: dto.schoolId },
    });
    if (existing) {
      return existing;
    }

    const link = this.founderSchoolRepo.create({
      founderId: dto.founderId,
      schoolId: dto.schoolId,
    });
    return this.founderSchoolRepo.save(link);
  }

  async unlink(id: string): Promise<void> {
    const link = await this.founderSchoolRepo.findOne({ where: { id } });
    if (!link) {
      throw new NotFoundException('این پیوند یافت نشد');
    }
    await this.founderSchoolRepo.delete(id);
  }
}
