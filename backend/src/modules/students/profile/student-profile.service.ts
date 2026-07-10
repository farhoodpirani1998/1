import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { ParentStudent } from '../../parent/entities/parent-student.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../../common/authorization/roles.enum';
import { ReportsService } from '../../reports/reports.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { AssessmentsService } from '../../student-assessments/assessments.service';
// Phase 5I: Student Document Management.
import { StudentDocumentsService } from '../../student-documents/student-documents.service';
// Phase 5L: Homework & Assignments.
import { HomeworkService } from '../../homework/homework.service';
import { buildStudentProfileView, StudentProfileView } from './student-profile-view.dto';

const RECENT_ATTENDANCE_LIMIT = 10;
const RECENT_DOCUMENTS_LIMIT = 10;
const RECENT_HOMEWORK_LIMIT = 10;

const PROFILE_RELATIONS = ['guardian', 'grade', 'academicYear', 'school'];

/**
 * Phase 5D: Student Profile.
 *
 * Composes the profile response from data already owned elsewhere —
 * it does not recompute tuition/payment totals itself (that stays in
 * ReportsService.studentStatement, the same source /reports/student/:id/
 * statement uses) and it does not duplicate StudentsService's or
 * ParentService's tenant/link checks, it re-runs the same *shape* of
 * check inline because this service sits below both controllers rather
 * than being called by them.
 */
@Injectable()
export class StudentProfileService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly reportsService: ReportsService,
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
    private readonly studentDocumentsService: StudentDocumentsService,
    private readonly homeworkService: HomeworkService,
  ) {}

  /**
   * school_admin (and other staff-side roles the controller allows):
   * the student only needs to belong to the caller's own school —
   * same tenant check as StudentsService.findOne().
   */
  async getForSchoolAdmin(studentId: string, schoolId: string): Promise<StudentProfileView> {
    const student = await this.loadStudent(studentId, schoolId);
    return this.assemble(student, schoolId);
  }

  /**
   * parent: the student must both belong to the caller's own school AND
   * be linked to this parent via parent_students — same two checks as
   * ParentService.findMyStudent(), kept as "not found" (never
   * "forbidden") so a parent probing another family's student UUID
   * can't distinguish "doesn't exist" from "exists but isn't yours".
   */
  async getForParent(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<StudentProfileView> {
    const link = await this.parentStudentRepo.findOne({
      where: { parentId, studentId },
    });
    if (!link) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    const student = await this.loadStudent(studentId, schoolId);
    return this.assemble(student, schoolId);
  }

  private async loadStudent(studentId: string, schoolId: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, schoolId },
      relations: PROFILE_RELATIONS,
    });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    return student;
  }

  private async assemble(student: Student, schoolId: string): Promise<StudentProfileView> {
    // Reuses ReportsService's existing tuition/installment/payment
    // aggregation (the same call /reports/student/:id/statement makes)
    // instead of re-deriving totals here.
    const statement = await this.reportsService.studentStatement(student.id, schoolId);

    // Every parent-portal login linked to this student (see
    // ParentStudent) — distinct from student.guardian, which is the
    // single billing contact captured on the student record itself.
    const parentUsers = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('parent_students', 'ps', 'ps.parent_id = user.id')
      .where('ps.student_id = :studentId', { studentId: student.id })
      .andWhere('user.schoolId = :schoolId', { schoolId })
      .andWhere('user.role = :role', { role: Role.PARENT })
      .getMany();

    // Phase 5E: recent attendance history for the profile's attendance
    // section. findRecentForStudent() does no tenant/link check of its
    // own -- loadStudent()/the parent_students check above have already
    // verified this student is one the caller may see by the time we get
    // here, same as statement/parentUsers just above.
    const attendanceRecords = await this.attendanceService.findRecentForStudent(
      student.id,
      RECENT_ATTENDANCE_LIMIT,
    );

    // Phase 5F: every recorded assessment for the profile's assessments
    // section and its embedded report-card summary. Unbounded (not
    // findRecentForStudent-style capped) because the report-card average
    // needs the full history to be correct; buildStudentProfileView
    // itself truncates the `records` list for display while still
    // averaging over everything.
    const assessmentRecords = await this.assessmentsService.findAllForStudent(student.id);

    // Phase 5I: recent documents for the profile's documents section.
    // findRecentForStudent() does no tenant/link check of its own --
    // loadStudent()/the parent_students check above have already verified
    // this student is one the caller may see by the time we get here,
    // same as statement/parentUsers/attendanceRecords/assessmentRecords
    // just above.
    const documentRecords = await this.studentDocumentsService.findRecentForStudent(
      student.id,
      RECENT_DOCUMENTS_LIMIT,
    );

    // Phase 5L: recent homework for the profile's homework section, keyed
    // by the student's *grade* (homework belongs to a grade, not an
    // individual student) rather than studentId -- same "no tenant/link
    // check of its own" convention as the reads just above, since
    // loadStudent()/the parent_students check have already verified this
    // student is one the caller may see by the time we get here.
    const homeworkRecords = await this.homeworkService.findRecentForGrade(
      student.gradeId,
      schoolId,
      RECENT_HOMEWORK_LIMIT,
    );

    return buildStudentProfileView({
      student,
      statement,
      parentUsers,
      attendanceRecords,
      assessmentRecords,
      documentRecords,
      homeworkRecords,
    });
  }
}
