// Mirrors backend/src/modules/search/dto/search-result-view.dto.ts 1:1
// (Phase 5N: Global Search). Every field here is the already-narrowed
// view the backend returns, not the raw entity.

export interface StudentSearchResult {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: string;
}

export interface ParentSearchResult {
  id: string;
  fullName: string;
  phone: string;
}

export interface TeacherSearchResult {
  id: string;
  fullName: string;
  phone: string;
}

export interface SubjectSearchResult {
  id: string;
  title: string;
}

export interface HomeworkSearchResult {
  id: string;
  title: string;
  dueDate: string;
}

export interface AnnouncementSearchResult {
  id: string;
  title: string;
  targetType: string;
  createdAt: string;
}

// Every key is always present (an empty array, never omitted) — see
// SearchResultsView on the backend.
export interface SearchResults {
  students: StudentSearchResult[];
  parents: ParentSearchResult[];
  teachers: TeacherSearchResult[];
  subjects: SubjectSearchResult[];
  homework: HomeworkSearchResult[];
  announcements: AnnouncementSearchResult[];
}
