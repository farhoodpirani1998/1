import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Guardian } from '../students/entities/guardian.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../student-assessments/entities/subject.entity';
import { Homework } from '../homework/entities/homework.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { Role } from '../../common/authorization/roles.enum';
import { QuerySearchDto } from './dto/query-search.dto';
import {
  SearchResultsView,
  toStudentSearchResult,
  toParentSearchResult,
  toTeacherSearchResult,
  toSubjectSearchResult,
  toHomeworkSearchResult,
  toAnnouncementSearchResult,
} from './dto/search-result-view.dto';

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

/**
 * Phase 5N: Global Search.
 *
 * Deliberately does not import StudentsModule / UsersModule / HomeworkModule
 * / AnnouncementsModule / StudentAssessmentsModule back into this module --
 * it only needs a single narrow read query against each entity, so it
 * declares its own TypeORM repos for Student/Guardian/User/Subject/Homework/
 * Announcement instead, same "own narrow repos, no cross-module import"
 * shape HomeworkModule/TimetableModule already use for the same reason
 * (see HomeworkModule's module-level comment). No business logic is
 * duplicated: every query here is a plain tenant-scoped ILIKE lookup, not a
 * re-implementation of any rule StudentsService/HomeworkService/etc. already
 * enforce (creation, assignment checks, parent-linking, and so on all stay
 * exactly where they are).
 *
 * Every one of the six queries is independently scoped to `schoolId` --
 * the same tenant-isolation shape every other service in this codebase
 * applies -- so a search term can never surface another school's rows,
 * regardless of how common the term is.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Guardian)
    private readonly guardianRepo: Repository<Guardian>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Homework)
    private readonly homeworkRepo: Repository<Homework>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
  ) {}

  /**
   * Runs all six category searches in parallel, each independently capped
   * at `limit` (default 10, hard ceiling 50 -- see QuerySearchDto), and
   * returns every group, even the empty ones. A blank/whitespace-only `q`
   * (still possible after DTO validation trims nothing itself) short-
   * circuits to all-empty groups rather than running six unfiltered
   * "match everything" queries against the school's full data.
   */
  async search(query: QuerySearchDto, schoolId: string): Promise<SearchResultsView> {
    const term = query.q.trim();
    const limit = this.normalizeLimit(query.limit);

    if (!term) {
      return { students: [], parents: [], teachers: [], subjects: [], homework: [], announcements: [] };
    }

    const like = `%${term}%`;

    const [students, parents, teachers, subjects, homework, announcements] = await Promise.all([
      this.searchStudents(like, schoolId, limit),
      this.searchParents(like, schoolId, limit),
      this.searchTeachers(like, schoolId, limit),
      this.searchSubjects(like, schoolId, limit),
      this.searchHomework(like, schoolId, limit),
      this.searchAnnouncements(like, schoolId, limit),
    ]);

    return {
      students: students.map(toStudentSearchResult),
      parents: parents.map(toParentSearchResult),
      teachers: teachers.map(toTeacherSearchResult),
      subjects: subjects.map(toSubjectSearchResult),
      homework: homework.map(toHomeworkSearchResult),
      announcements: announcements.map(toAnnouncementSearchResult),
    };
  }

  // ---------------------------------------------------------------------
  // per-category queries
  // ---------------------------------------------------------------------

  private searchStudents(like: string, schoolId: string, limit: number): Promise<Student[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .where('student.schoolId = :schoolId', { schoolId })
      .andWhere('(student.fullName ILIKE :like OR student.nationalId ILIKE :like)', { like })
      .orderBy('student.fullName', 'ASC')
      .take(limit)
      .getMany();
  }

  // Guardian is school-scoped directly (schoolId column), same as every
  // other entity here -- no join through Student is needed.
  private searchParents(like: string, schoolId: string, limit: number): Promise<Guardian[]> {
    return this.guardianRepo
      .createQueryBuilder('guardian')
      .where('guardian.schoolId = :schoolId', { schoolId })
      .andWhere('(guardian.fullName ILIKE :like OR guardian.phone ILIKE :like)', { like })
      .orderBy('guardian.fullName', 'ASC')
      .take(limit)
      .getMany();
  }

  // Teachers are User rows with role = 'teacher' -- same convention
  // TeacherService/TeacherAssignment already rely on (see Role.TEACHER).
  private searchTeachers(like: string, schoolId: string, limit: number): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.schoolId = :schoolId', { schoolId })
      .andWhere('user.role = :role', { role: Role.TEACHER })
      .andWhere('(user.fullName ILIKE :like OR user.phone ILIKE :like)', { like })
      .orderBy('user.fullName', 'ASC')
      .take(limit)
      .getMany();
  }

  private searchSubjects(like: string, schoolId: string, limit: number): Promise<Subject[]> {
    return this.subjectRepo
      .createQueryBuilder('subject')
      .where('subject.schoolId = :schoolId', { schoolId })
      .andWhere('subject.title ILIKE :like', { like })
      .orderBy('subject.title', 'ASC')
      .take(limit)
      .getMany();
  }

  private searchHomework(like: string, schoolId: string, limit: number): Promise<Homework[]> {
    return this.homeworkRepo
      .createQueryBuilder('homework')
      .where('homework.schoolId = :schoolId', { schoolId })
      .andWhere('(homework.title ILIKE :like OR homework.description ILIKE :like)', { like })
      .orderBy('homework.dueDate', 'DESC')
      .take(limit)
      .getMany();
  }

  private searchAnnouncements(like: string, schoolId: string, limit: number): Promise<Announcement[]> {
    return this.announcementRepo
      .createQueryBuilder('announcement')
      .where('announcement.schoolId = :schoolId', { schoolId })
      .andWhere('(announcement.title ILIKE :like OR announcement.message ILIKE :like)', { like })
      .orderBy('announcement.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return DEFAULT_SEARCH_LIMIT;
    }
    return Math.min(Math.floor(limit), MAX_SEARCH_LIMIT);
  }
}
