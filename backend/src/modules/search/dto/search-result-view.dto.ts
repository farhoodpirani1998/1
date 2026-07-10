import { Student } from '../../students/entities/student.entity';
import { Guardian } from '../../students/entities/guardian.entity';
import { User } from '../../users/entities/user.entity';
import { Subject } from '../../student-assessments/entities/subject.entity';
import { Homework } from '../../homework/entities/homework.entity';
import { Announcement } from '../../announcements/entities/announcement.entity';

// Phase 5N: Global Search.
//
// Every view below is a deliberately narrow reshape of its source entity
// -- same "reshape, don't leak the ORM entity as-is" reasoning as
// toHomeworkView / toAnnouncementView elsewhere. This matters most for
// TeacherSearchResult: it's built from a raw User row, and User carries
// passwordHash/tokenVersion, neither of which may ever leave the service
// layer -- see toTeacherSearchResult() below.

export interface StudentSearchResult {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: string;
}

export function toStudentSearchResult(student: Student): StudentSearchResult {
  return {
    id: student.id,
    fullName: student.fullName,
    nationalId: student.nationalId,
    status: student.status,
  };
}

// "Parents" maps to the Guardian entity, not to a role='parent' User --
// Guardian is the per-school contact record every Student links to
// (fullName + phone), which is what a school_admin/accountant/staff
// searching for "a parent" actually means: the guardian on file for a
// student, not who holds a parent-portal login.
export interface ParentSearchResult {
  id: string;
  fullName: string;
  phone: string;
}

export function toParentSearchResult(guardian: Guardian): ParentSearchResult {
  return {
    id: guardian.id,
    fullName: guardian.fullName,
    phone: guardian.phone,
  };
}

export interface TeacherSearchResult {
  id: string;
  fullName: string;
  phone: string;
}

export function toTeacherSearchResult(teacher: User): TeacherSearchResult {
  return {
    id: teacher.id,
    fullName: teacher.fullName,
    phone: teacher.phone,
  };
}

export interface SubjectSearchResult {
  id: string;
  title: string;
}

export function toSubjectSearchResult(subject: Subject): SubjectSearchResult {
  return {
    id: subject.id,
    title: subject.title,
  };
}

export interface HomeworkSearchResult {
  id: string;
  title: string;
  dueDate: string;
}

export function toHomeworkSearchResult(homework: Homework): HomeworkSearchResult {
  return {
    id: homework.id,
    title: homework.title,
    dueDate: homework.dueDate,
  };
}

export interface AnnouncementSearchResult {
  id: string;
  title: string;
  targetType: string;
  createdAt: Date;
}

export function toAnnouncementSearchResult(announcement: Announcement): AnnouncementSearchResult {
  return {
    id: announcement.id,
    title: announcement.title,
    targetType: announcement.targetType,
    createdAt: announcement.createdAt,
  };
}

// The grouped response shape GET /search always returns -- every key
// present even when a category has no matches (an empty array, never an
// omitted key), so callers can destructure without existence checks.
export interface SearchResultsView {
  students: StudentSearchResult[];
  parents: ParentSearchResult[];
  teachers: TeacherSearchResult[];
  subjects: SubjectSearchResult[];
  homework: HomeworkSearchResult[];
  announcements: AnnouncementSearchResult[];
}
