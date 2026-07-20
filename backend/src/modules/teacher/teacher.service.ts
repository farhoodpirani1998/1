import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Brackets } from 'typeorm';
import { TeacherAssignment } from './entities/teacher-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Class } from '../classes/entities/class.entity';
import { Attendance, AttendanceStatus } from '../attendance/entities/attendance.entity';
import { Assessment } from '../student-assessments/entities/assessment.entity';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { QueryTeacherStudentsDto } from './dto/query-teacher-students.dto';
import { QueryTeacherAttendanceDto } from './dto/query-teacher-attendance.dto';
import { QueryTeacherAttendanceStatusDto } from './dto/query-teacher-attendance-status.dto';
import { QueryTeacherAssessmentsDto } from './dto/query-teacher-assessments.dto';
import { QueryTeacherHomeworkSubmissionsDto } from './dto/query-teacher-homework-submissions.dto';
import { TeacherClassAttendanceStatusView } from './dto/teacher-view.dto';
import {
  TeacherHomeworkSubmissionSummaryView,
  TeacherHomeworkSubmissionStatisticsView,
} from './dto/teacher-homework-submission-view.dto';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { CreateAssessmentDto } from '../student-assessments/dto/create-assessment.dto';
import { AttendanceService } from '../attendance/attendance.service';
import { AssessmentsService } from '../student-assessments/assessments.service';
import { Role } from '../../common/authorization/roles.enum';
import { StudentProfileService } from '../students/profile/student-profile.service';
import { StudentProfileView } from '../students/profile/student-profile-view.dto';
import { Homework } from '../homework/entities/homework.entity';
import { HomeworkService } from '../homework/homework.service';
import {
  HomeworkSubmissionService,
} from '../homework/homework-submission.service';
import { HomeworkSubmission, HomeworkSubmissionStatus } from '../homework/entities/homework-submission.entity';

// Sprint 2B: 'teacher' added alongside 'grade'/'subject' so
// toTeacherAssignmentView can populate teacherName as well as
// gradeTitle/subjectTitle. Used by both assign() and listAssignments()
// below -- every admin-facing assignment read now carries all three
// relations, never just grade/subject.
const ASSIGNMENT_RELATIONS = ['teacher', 'grade', 'subject', 'class'];

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
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    // AttendanceService/AssessmentsService already own every tenant check
    // and the upsert-on-resubmit business logic for their respective
    // tables -- this module only adds the extra "is this teacher actually
    // assigned to this class/subject" gate in front of them, never
    // reimplements what they already do (see recordAttendance /
    // recordAssessment below).
    private readonly attendanceService: AttendanceService,
    private readonly assessmentsService: AssessmentsService,
    // Backs GET /teacher/students/:id/profile — reuses the exact same
    // aggregation as the school_admin-facing GET /students/:id/profile
    // (StudentProfileService.getForSchoolAdmin already does the
    // schoolId tenant check); getStudentProfile() below only adds the
    // same "is this teacher assigned to this student's grade" gate used
    // by recordAttendance/recordAssessment, never a second copy of the
    // profile-building logic itself.
    private readonly studentProfileService: StudentProfileService,
    // Sprint A.3.3 — teacher-facing homework submission reads. Neither
    // service's own tenant/business logic is duplicated here:
    // HomeworkService.findOneForSchool() still owns the homework
    // tenant check, and HomeworkSubmissionService.findForHomework()
    // still owns every piece of submission-row business logic. This
    // module only adds the same "is this teacher actually assigned to
    // this (grade, subject)" gate recordAttendance/recordAssessment
    // already use, plus the roster-aware aggregation described on
    // buildRosterAwareSubmissionSummary() below.
    private readonly homeworkService: HomeworkService,
    private readonly homeworkSubmissionService: HomeworkSubmissionService,
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

    // subjectId is optional -- see CreateTeacherAssignmentDto. Left out,
    // it means this teacher covers every subject for the grade (the
    // elementary-grade case), so there's no subject row to resolve or
    // tenant-check against.
    if (dto.subjectId) {
      const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
      if (!subject) {
        throw new NotFoundException('درس یافت نشد');
      }
      if (subject.schoolId !== schoolId) {
        throw new ForbiddenException('این درس متعلق به مدرسه دیگری است');
      }
    }

    // classId is optional -- see CreateTeacherAssignmentDto. Left out,
    // it means this teacher covers every section of the grade (the
    // pre-existing behavior). Given, it must be a class of this exact
    // grade -- otherwise a class from a different grade (or a different
    // school) could silently scope the assignment to the wrong roster.
    if (dto.classId) {
      const klass = await this.classRepo.findOne({ where: { id: dto.classId } });
      if (!klass) {
        throw new NotFoundException('کلاس یافت نشد');
      }
      if (klass.schoolId !== schoolId) {
        throw new ForbiddenException('این کلاس متعلق به مدرسه دیگری است');
      }
      if (klass.gradeId !== dto.gradeId) {
        throw new BadRequestException('این کلاس متعلق به این پایه نیست');
      }
    }

    const existing = await this.assignmentRepo.findOne({
      where: {
        teacherId: dto.teacherId,
        gradeId: dto.gradeId,
        subjectId: dto.subjectId ?? IsNull(),
        classId: dto.classId ?? IsNull(),
      },
      relations: ASSIGNMENT_RELATIONS,
    });
    if (existing) {
      return existing;
    }

    const assignment = this.assignmentRepo.create({
      schoolId,
      teacherId: dto.teacherId,
      gradeId: dto.gradeId,
      subjectId: dto.subjectId ?? null,
      classId: dto.classId ?? null,
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
      if (a.subjectId && a.subject && !seen.has(a.subjectId)) {
        seen.add(a.subjectId);
        subjects.push(a.subject);
      }
    }
    return subjects;
  }

  /**
   * Every student in one of the teacher's assigned (grade, class) scopes
   * -- all of them, or narrowed to one grade/class via
   * QueryTeacherStudentsDto. An assignment with classId === null covers
   * every section of that grade (the pre-existing behavior); an
   * assignment with a real classId covers only that one section -- this
   * is the actual fix for the bug where two teachers of two different
   * sections of the same grade both saw the entire grade's roster.
   *
   * A gradeId/classId filter that isn't covered by one of the teacher's
   * own assignments is rejected the same way an out-of-tenant id is
   * rejected elsewhere in the app (Forbidden), never silently returning
   * an empty list that could be mistaken for "this class has no
   * students".
   */
  async getMyStudents(
    teacherId: string,
    schoolId: string,
    query: QueryTeacherStudentsDto,
  ): Promise<Student[]> {
    const { wholeGradeIds, classIds } = await this.resolveClassScope(
      teacherId,
      schoolId,
      query.gradeId,
      query.classId,
    );

    if (wholeGradeIds.length === 0 && classIds.length === 0) {
      return [];
    }

    const qb = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.grade', 'grade')
      .leftJoinAndSelect('student.class', 'class')
      .where('student.schoolId = :schoolId', { schoolId })
      .andWhere(
        new Brackets((sub) => {
          if (wholeGradeIds.length > 0) {
            sub.orWhere('student.gradeId IN (:...wholeGradeIds)', { wholeGradeIds });
          }
          if (classIds.length > 0) {
            sub.orWhere('student.classId IN (:...classIds)', { classIds });
          }
        }),
      )
      .orderBy('student.fullName', 'ASC');

    return qb.getMany();
  }

  /**
   * Backs GET /teacher/students/:id/profile — the same profile card
   * (photo/info/parent phone/attendance/average/progress/homework) the
   * school_admin portal sees, scoped to a teacher's own assigned
   * students. Same (grade, class) scoping rule as recordAttendance()
   * below: a teacher may open the profile of any student covered by one
   * of their assignments, not just grades they teach a specific subject
   * in -- and, for a class-scoped assignment, only students actually
   * placed in that exact section.
   */
  async getStudentProfile(
    teacherId: string,
    schoolId: string,
    studentId: string,
  ): Promise<StudentProfileView> {
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    const assignments = await this.assignmentRepo.find({
      where: { teacherId, schoolId, gradeId: student.gradeId },
    });
    if (!assignments.some((a) => this.assignmentCoversStudent(a, student))) {
      throw new ForbiddenException('شما به کلاس این دانش‌آموز دسترسی ندارید');
    }

    return this.studentProfileService.getForSchoolAdmin(studentId, schoolId);
  }

  // ---------------------------------------------------------------------
  // Sprint A.1: teacher-side attendance reads. Every method below
  // resolves the same (whole-grade, class) scope getMyStudents() uses
  // (see resolveClassScope()), then delegates the actual attendance
  // query to AttendanceService.findByDateForScope() -- AttendanceService
  // still owns every piece of Attendance-table business logic; this
  // section only adds the "which classes is this teacher actually
  // scoped to" gate in front of it, same shape as recordAttendance()
  // below.
  // ---------------------------------------------------------------------

  /**
   * Today's attendance across the teacher's assigned classes (or one
   * grade/class within them, via QueryTeacherAttendanceDto). "Today" is
   * the caller's server-local calendar day, same YYYY-MM-DD convention
   * every other date-typed column in this codebase already uses (see
   * Attendance.date).
   */
  async getMyAttendanceToday(
    teacherId: string,
    schoolId: string,
    query: QueryTeacherAttendanceDto,
  ): Promise<Attendance[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.getMyAttendanceByDate(teacherId, schoolId, today, query);
  }

  /**
   * Attendance across the teacher's assigned classes (or one grade/class
   * within them) for one explicit calendar day. A gradeId/classId filter
   * that isn't covered by one of the teacher's own assignments is
   * rejected the same way getMyStudents() rejects it (Forbidden), never
   * silently returning an empty list.
   */
  async getMyAttendanceByDate(
    teacherId: string,
    schoolId: string,
    date: string,
    query: QueryTeacherAttendanceDto,
  ): Promise<Attendance[]> {
    const { wholeGradeIds, classIds } = await this.resolveClassScope(
      teacherId,
      schoolId,
      query.gradeId,
      query.classId,
    );

    if (wholeGradeIds.length === 0 && classIds.length === 0) {
      return [];
    }

    return this.attendanceService.findByDateForScope(date, schoolId, {
      gradeIds: wholeGradeIds,
      classIds,
    });
  }

  /**
   * Per-class attendance status for one calendar day (defaults to today)
   * -- one row per class the teacher is scoped to, with roster size and
   * present/absent/late/excused counts, so the teacher portal can show
   * "which of my classes still need attendance taken today" at a glance.
   *
   * Built from two reads that already exist for other reasons
   * (getMyStudents() for the roster, AttendanceService.findByDateForScope
   * for the day's records) rather than a third query path of its own --
   * the grouping/counting here is presentation logic specific to this
   * one summary view, not a new business rule.
   */
  async getMyAttendanceStatus(
    teacherId: string,
    schoolId: string,
    query: QueryTeacherAttendanceStatusDto,
  ): Promise<TeacherClassAttendanceStatusView[]> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);

    const students = await this.getMyStudents(teacherId, schoolId, {
      gradeId: query.gradeId,
      classId: query.classId,
    });
    if (students.length === 0) {
      return [];
    }

    const { wholeGradeIds, classIds } = await this.resolveClassScope(
      teacherId,
      schoolId,
      query.gradeId,
      query.classId,
    );
    const records = await this.attendanceService.findByDateForScope(date, schoolId, {
      gradeIds: wholeGradeIds,
      classIds,
    });
    const recordByStudentId = new Map(records.map((r) => [r.studentId, r]));

    // Group the roster by (gradeId, classId) -- classId null groups
    // students of that grade not yet placed in a section into their own
    // "بدون کلاس" bucket, same fallback label convention as
    // toTeacherAssignmentView's classTitle above.
    const groups = new Map<string, { gradeId: string; gradeTitle?: string; classId: string | null; classTitle: string; students: Student[] }>();
    for (const student of students) {
      const key = `${student.gradeId}:${student.classId ?? ''}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          gradeId: student.gradeId,
          gradeTitle: student.grade?.title,
          classId: student.classId,
          classTitle: student.classId ? student.class?.title ?? '' : 'بدون کلاس',
          students: [],
        };
        groups.set(key, group);
      }
      group.students.push(student);
    }

    return [...groups.values()].map((group) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;
      let recordedCount = 0;

      for (const student of group.students) {
        const record = recordByStudentId.get(student.id);
        if (!record) continue;
        recordedCount += 1;
        switch (record.status) {
          case AttendanceStatus.PRESENT:
            present += 1;
            break;
          case AttendanceStatus.ABSENT:
            absent += 1;
            break;
          case AttendanceStatus.LATE:
            late += 1;
            break;
          case AttendanceStatus.EXCUSED:
            excused += 1;
            break;
        }
      }

      return {
        gradeId: group.gradeId,
        gradeTitle: group.gradeTitle,
        classId: group.classId,
        classTitle: group.classTitle,
        totalStudents: group.students.length,
        recordedCount,
        notRecordedCount: group.students.length - recordedCount,
        present,
        absent,
        late,
        excused,
      };
    });
  }

  // ---------------------------------------------------------------------
  // Sprint A.2: teacher-side assessment reads. Same shape as the Sprint
  // A.1 attendance-read section above -- resolve the caller's own scope,
  // reject a filter that isn't covered by it, then delegate the actual
  // record lookup to AssessmentsService.findForScope(), which still owns
  // every piece of Assessment-table business logic. The one difference
  // from attendance's scope: assessments are per-subject, so the scope
  // resolved here (see resolveAssessmentScope()) carries a subjectId per
  // entry alongside grade/class, not just the two grade/class buckets
  // resolveClassScope() produces.
  // ---------------------------------------------------------------------

  /**
   * Assessments across the teacher's assigned (grade, class, subject)
   * scopes, most recent first, optionally narrowed by
   * gradeId/classId/subjectId/studentId/fromDate/toDate. A
   * gradeId/classId/subjectId that isn't covered by any of the teacher's
   * own assignments is rejected (Forbidden), same as every Sprint A.1
   * filter; a studentId outside the school 404s (same "can't tell
   * nonexistent from someone else's" shape as getStudentProfile's own
   * student lookup) and a studentId inside the school but outside the
   * teacher's resolved scope is rejected (Forbidden) rather than
   * silently returning an empty list.
   */
  async getMyAssessments(
    teacherId: string,
    schoolId: string,
    query: QueryTeacherAssessmentsDto,
  ): Promise<Assessment[]> {
    const entries = await this.resolveAssessmentScope(
      teacherId,
      schoolId,
      query.gradeId,
      query.classId,
      query.subjectId,
    );

    if (entries.length === 0) {
      return [];
    }

    if (query.studentId) {
      const student = await this.studentRepo.findOne({ where: { id: query.studentId, schoolId } });
      if (!student) {
        throw new NotFoundException('دانش‌آموز یافت نشد');
      }
      const covered = entries.some(
        (e) => e.gradeId === student.gradeId && (e.classId === null || e.classId === student.classId),
      );
      if (!covered) {
        throw new ForbiddenException('شما به این دانش‌آموز دسترسی ندارید');
      }
    }

    return this.assessmentsService.findForScope(schoolId, entries, {
      studentId: query.studentId,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
  }

  // ---------------------------------------------------------------------
  // Sprint A.3.3: teacher-side homework submission reads. Grading and
  // file uploads are out of scope (same as HomeworkSubmissionService
  // itself) -- every method below is read-only.
  //
  // Access to any of these three routes is gated by the same rule:
  // the homework must exist within the caller's school (delegated to
  // HomeworkService.findOneForSchool(), never re-derived here) AND the
  // teacher must hold an assignment covering the homework's own
  // (gradeId, subjectId) -- an exact subjectId match, or a NULL-subject
  // "all subjects" assignment for that grade, same shape
  // HomeworkService.assertAssigned() already enforces for *posting*
  // homework, and the same (gradeId, subjectId) covered-check
  // recordAssessment() above uses for assessments. This is deliberately
  // NOT restricted to homework this teacher personally created -- two
  // teachers can share a (grade, subject) assignment (e.g. covering for
  // each other), and both are meant to see the same roster-aware
  // breakdown, same "assignment-scoped, not creator-scoped" reasoning
  // getMyStudents()/getMyAttendanceStatus() already apply to attendance.
  // ---------------------------------------------------------------------

  /**
   * Every submission row recorded for one homework, most recently
   * updated first -- a thin pass-through to
   * HomeworkSubmissionService.findForHomework() once the assignment
   * gate above has cleared, optionally narrowed to one status via
   * QueryTeacherHomeworkSubmissionsDto. The status filter is applied
   * here (over an already-fetched list), not pushed into
   * HomeworkSubmissionService, to keep that service's own read methods
   * generic -- same "roster-aware aggregation belongs only to the
   * teacher layer" reasoning the roster-aware summary below documents.
   */
  async getMyHomeworkSubmissions(
    teacherId: string,
    schoolId: string,
    homeworkId: string,
    query: QueryTeacherHomeworkSubmissionsDto = {},
  ): Promise<HomeworkSubmission[]> {
    await this.assertHomeworkAccessible(teacherId, schoolId, homeworkId);
    const submissions = await this.homeworkSubmissionService.findForHomework(homeworkId, schoolId);
    return query.status ? submissions.filter((s) => s.status === query.status) : submissions;
  }

  /**
   * Roster-aware per-status breakdown for one homework.
   *
   * Unlike HomeworkSubmissionService.getSummary() -- which counts
   * submission *rows* only, and documents its own gap ("a student with
   * no submission row yet is simply absent from every count") -- this
   * counts against the teacher's *actual assigned roster* for the
   * homework's grade (via getMyStudents(), the same roster resolution
   * every other teacher-facing read in this service already reuses).
   * totalStudents is therefore the real class size, not a count of
   * existing submission rows: a student with no row at all still counts
   * toward missingCount instead of vanishing from every total. This
   * roster cross-referencing is exactly the "future teacher-facing
   * summary" HomeworkSubmissionService.getSummary()'s own comment
   * anticipates -- it lives here, not in that generic service, which
   * stays roster-agnostic.
   */
  async getMyHomeworkSubmissionSummary(
    teacherId: string,
    schoolId: string,
    homeworkId: string,
  ): Promise<TeacherHomeworkSubmissionSummaryView> {
    const counts = await this.buildRosterAwareSubmissionSummary(teacherId, schoolId, homeworkId);
    return { homeworkId, ...counts };
  }

  /**
   * Same roster-aware counts as getMyHomeworkSubmissionSummary() above,
   * reshaped with the percentage rates derived from them -- built from
   * the same buildRosterAwareSubmissionSummary() call, not a second
   * aggregation pass over the roster/submissions.
   */
  async getMyHomeworkSubmissionStatistics(
    teacherId: string,
    schoolId: string,
    homeworkId: string,
  ): Promise<TeacherHomeworkSubmissionStatisticsView> {
    const counts = await this.buildRosterAwareSubmissionSummary(teacherId, schoolId, homeworkId);
    const { totalStudents, submittedCount, pendingCount, missingCount, lateCount } = counts;

    const rate = (count: number): number =>
      totalStudents === 0 ? 0 : Math.round((count / totalStudents) * 1000) / 10;

    return {
      homeworkId,
      ...counts,
      submissionRate: rate(submittedCount + lateCount),
      onTimeRate: rate(submittedCount),
      lateRate: rate(lateCount),
      pendingRate: rate(pendingCount),
      missingRate: rate(missingCount),
    };
  }

  // ---------------------------------------------------------------------
  // teacher-side scoped writes -- delegate all business logic to the
  // existing services, only adding the assignment gate in front
  // ---------------------------------------------------------------------

  /**
   * Attendance has no subject of its own (see Attendance entity), so a
   * teacher may take attendance for any student in any (grade, class)
   * scope they're assigned to, regardless of which subject that
   * assignment is for -- matches how attendance is recorded in every
   * other role (per class, not per subject).
   *
   * A whole-grade assignment (classId null) covers every student of that
   * grade, same as before this fix; a class-scoped assignment covers
   * only students placed in that exact class -- this is the gate that
   * stops a teacher of one section from marking attendance for a
   * different section of the same grade.
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

    const assignments = await this.assignmentRepo.find({
      where: { teacherId, schoolId, gradeId: student.gradeId },
    });
    if (!assignments.some((a) => this.assignmentCoversStudent(a, student))) {
      throw new ForbiddenException('شما به کلاس این دانش‌آموز دسترسی ندارید');
    }

    // AttendanceService.record() re-derives academicYearId from the
    // student itself and re-checks student.schoolId === schoolId, so the
    // tenant check here is only the extra assignment gate, not a
    // duplicate of what AttendanceService already guarantees.
    return this.attendanceService.record(dto, schoolId, teacherId);
  }

  /**
   * Assessments are per-subject, so the teacher must hold an assignment
   * matching the student's current (grade, class) scope *and* either the
   * subject in the request body or a NULL subject ("all subjects",
   * elementary case) -- not just any assignment for that grade/class
   * like attendance above.
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

    const assignments = await this.assignmentRepo.find({
      where: { teacherId, schoolId, gradeId: student.gradeId },
    });
    const covered = assignments.some(
      (a) =>
        this.assignmentCoversStudent(a, student) &&
        (a.subjectId === dto.subjectId || a.subjectId === null),
    );
    if (!covered) {
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

  /**
   * The single scope-resolution rule getMyStudents() and every Sprint
   * A.1 attendance-read method above reduce to: start from the
   * teacher's own assignments, narrow to an explicit gradeId/classId if
   * one was requested (rejecting the request if it isn't covered by any
   * of the teacher's assignments -- Forbidden, same as an out-of-tenant
   * id elsewhere in this codebase), then split what's left into
   * "whole-grade" ids (classId null -- every section of that grade) and
   * "class-scoped" ids (a specific section only). A grade already
   * covered whole is not additionally narrowed by a class-scoped row for
   * the same grade.
   */
  private async resolveClassScope(
    teacherId: string,
    schoolId: string,
    gradeId?: string,
    classId?: string,
  ): Promise<{ wholeGradeIds: string[]; classIds: string[] }> {
    let assignments = await this.getMyAssignments(teacherId, schoolId);

    if (gradeId) {
      assignments = assignments.filter((a) => a.gradeId === gradeId);
      if (assignments.length === 0) {
        throw new ForbiddenException('شما به این کلاس دسترسی ندارید');
      }
    }
    if (classId) {
      // A whole-grade assignment (classId null) also covers a specific
      // class filter within that grade -- it just means "every class",
      // this one included.
      assignments = assignments.filter((a) => a.classId === classId || a.classId === null);
      if (assignments.length === 0) {
        throw new ForbiddenException('شما به این کلاس دسترسی ندارید');
      }
    }

    if (assignments.length === 0) {
      return { wholeGradeIds: [], classIds: [] };
    }

    const wholeGradeIds = [...new Set(assignments.filter((a) => a.classId === null).map((a) => a.gradeId))];
    const classIds = [
      ...new Set(
        assignments
          .filter((a) => a.classId !== null && !wholeGradeIds.includes(a.gradeId))
          .map((a) => a.classId as string),
      ),
    ];

    return { wholeGradeIds, classIds };
  }

  /**
   * Sprint A.2's equivalent of resolveClassScope() above, extended with a
   * subjectId leg since assessments (unlike attendance) are per-subject.
   * Same "narrow to an explicit filter, reject if it isn't covered by any
   * of the teacher's own assignments" contract, but returns one
   * (gradeId, classId, subjectId) tuple per distinct assignment rather
   * than two flat id arrays, since a class-scoped Math assignment and a
   * whole-grade Science assignment on the *same* grade cover genuinely
   * different (scope, subject) combinations that a flat gradeIds/classIds
   * split would conflate.
   */
  private async resolveAssessmentScope(
    teacherId: string,
    schoolId: string,
    gradeId?: string,
    classId?: string,
    subjectId?: string,
  ): Promise<{ gradeId: string; classId: string | null; subjectId: string | null }[]> {
    let assignments = await this.getMyAssignments(teacherId, schoolId);

    if (gradeId) {
      assignments = assignments.filter((a) => a.gradeId === gradeId);
      if (assignments.length === 0) {
        throw new ForbiddenException('شما به این کلاس دسترسی ندارید');
      }
    }
    if (classId) {
      // A whole-grade assignment (classId null) also covers a specific
      // class filter within that grade -- same "null means every
      // section" rule as resolveClassScope().
      assignments = assignments.filter((a) => a.classId === classId || a.classId === null);
      if (assignments.length === 0) {
        throw new ForbiddenException('شما به این کلاس دسترسی ندارید');
      }
    }
    if (subjectId) {
      // A NULL-subject assignment ("all subjects", the elementary case
      // recordAssessment() already handles) also covers a specific
      // subject filter, same "null means every X" shape as classId above.
      assignments = assignments.filter((a) => a.subjectId === subjectId || a.subjectId === null);
      if (assignments.length === 0) {
        throw new ForbiddenException('شما برای این درس تخصیص ندارید');
      }
    }

    if (assignments.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const entries: { gradeId: string; classId: string | null; subjectId: string | null }[] = [];
    for (const a of assignments) {
      const key = `${a.gradeId}:${a.classId ?? ''}:${a.subjectId ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ gradeId: a.gradeId, classId: a.classId, subjectId: a.subjectId });
      }
    }
    return entries;
  }

  /**
   * The shared access gate for every Sprint A.3.3 homework submission
   * read: resolves the homework through
   * HomeworkService.findOneForSchool() (NotFound if it doesn't exist at
   * all, Forbidden if it exists but belongs to another school -- that
   * split is HomeworkService's own, not re-implemented here), then
   * checks the caller holds a TeacherAssignment covering the homework's
   * (gradeId, subjectId) -- an exact subjectId match, or a NULL-subject
   * "all subjects" assignment for that grade. Same shape
   * HomeworkService's own private assertAssigned() uses when a teacher
   * *posts* homework, and the same (gradeId, subjectId) covered-check
   * recordAssessment() above applies when a teacher records a score.
   */
  private async assertHomeworkAccessible(
    teacherId: string,
    schoolId: string,
    homeworkId: string,
  ): Promise<Homework> {
    const homework = await this.homeworkService.findOneForSchool(homeworkId, schoolId);

    const assignments = await this.assignmentRepo.find({
      where: { teacherId, schoolId, gradeId: homework.gradeId },
    });
    const covered = assignments.some((a) => a.subjectId === homework.subjectId || a.subjectId === null);
    if (!covered) {
      throw new ForbiddenException('شما به این تکلیف دسترسی ندارید');
    }

    return homework;
  }

  /**
   * The single roster-aware aggregation getMyHomeworkSubmissionSummary()
   * and getMyHomeworkSubmissionStatistics() both build on. Same
   * "single list read, several counts derived from it" shape
   * getMyAttendanceStatus() above already uses for its own
   * present/absent/late/excused breakdown, extended with the one thing
   * that method's roster (getMyStudents()) already gives it for free
   * and HomeworkSubmissionService.getSummary() explicitly does not
   * have: a real class roster to count *missing* rows against, not just
   * the rows that happen to exist.
   *
   * A roster student with no submission row at all counts toward
   * missingCount -- the same "derive `missing` at read time for a row
   * that was never created" state HomeworkSubmission's own header
   * comment anticipates a future consumer supplying. An explicit
   * `missing`-status row (set some other way) is also counted here,
   * never double-counted against the same student.
   */
  private async buildRosterAwareSubmissionSummary(
    teacherId: string,
    schoolId: string,
    homeworkId: string,
  ): Promise<{
    totalStudents: number;
    submittedCount: number;
    pendingCount: number;
    missingCount: number;
    lateCount: number;
  }> {
    const homework = await this.assertHomeworkAccessible(teacherId, schoolId, homeworkId);

    const students = await this.getMyStudents(teacherId, schoolId, { gradeId: homework.gradeId });
    const submissions = await this.homeworkSubmissionService.findForHomework(homeworkId, schoolId);
    const submissionByStudentId = new Map(submissions.map((s) => [s.studentId, s]));

    let submittedCount = 0;
    let pendingCount = 0;
    let missingCount = 0;
    let lateCount = 0;

    for (const student of students) {
      const submission = submissionByStudentId.get(student.id);
      if (!submission) {
        missingCount += 1;
        continue;
      }
      switch (submission.status) {
        case HomeworkSubmissionStatus.SUBMITTED:
          submittedCount += 1;
          break;
        case HomeworkSubmissionStatus.PENDING:
          pendingCount += 1;
          break;
        case HomeworkSubmissionStatus.MISSING:
          missingCount += 1;
          break;
        case HomeworkSubmissionStatus.LATE:
          lateCount += 1;
          break;
      }
    }

    return {
      totalStudents: students.length,
      submittedCount,
      pendingCount,
      missingCount,
      lateCount,
    };
  }

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

  /**
   * The single rule every class-scoping check in this service reduces
   * to: a whole-grade assignment (classId null) covers any student of
   * that grade regardless of section; a class-scoped assignment covers
   * only a student actually placed in that exact class. A student with
   * no classId of their own (not yet placed in a section) can only ever
   * be covered by a whole-grade assignment, never by a specific one --
   * there's no section to match against.
   */
  private assignmentCoversStudent(assignment: TeacherAssignment, student: Student): boolean {
    if (assignment.gradeId !== student.gradeId) {
      return false;
    }
    if (assignment.classId === null) {
      return true;
    }
    return assignment.classId === student.classId;
  }
}
