// Shared "پروفایل دانش‌آموز" card — every place in the app that opens a
// student profile (TeacherAssessmentsPage, TeacherStudentsPage,
// StudentsPage, ...) renders this exact component, so the profile looks
// and behaves the same regardless of which list it was opened from.
//
// Data comes from GET /students/:id/profile (school_admin/accountant) or
// GET /teacher/students/:id/profile (teacher, scoped to their own
// assigned students) — both return the exact same StudentProfileView
// shape (see types/studentProfile.types.ts), built by the same backend
// buildStudentProfileView(). This component only picks which hook to
// call via the `role` prop; the rendering below never branches on role.
//
// Real, backend-backed sections: photo (initial-letter avatar — the
// backend has no photo field, same as StudentDetailPage's own
// <StudentAvatar/>), info, parent phone numbers, attendance history,
// average + progress chart (from assessments/reportSummary), homework.
//
// Mock sections (رفتار / تشویق / اخطار — behavior / encouragement /
// warning): there is no backend concept for any of these today (no
// entity, no endpoint — see repo-wide search before this component was
// added). Each is rendered from a small deterministic generator seeded
// by the student id (so the same student always shows the same sample
// data within a session, instead of reshuffling on every re-render) and
// carries a visible "نمونه" (sample) tag plus a one-line note, the same
// "future-ready, not yet implemented" honesty the backend already uses
// for the `announcements` section (`available: false`). Do not wire
// real writes to these three sections without a backend resource behind
// them first.

import { useMemo, type ReactNode } from 'react';
import { Modal } from './Modal';
import { StatCard } from './StatCard';
import { InfoRow } from './InfoRow';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { formatDate, formatToman } from '../lib/format';
import { useStudentProfile } from '../hooks/useStudent';
import { useTeacherStudentProfile } from '../hooks/useTeacher';
import type { StudentProfileView } from '../types/studentProfile.types';

export type StudentProfileRole = 'admin' | 'teacher';

interface StudentProfileModalProps {
  studentId: string | undefined;
  open: boolean;
  onClose: () => void;
  /** 'admin' reads GET /students/:id/profile (school_admin/accountant);
   *  'teacher' reads GET /teacher/students/:id/profile, scoped to the
   *  signed-in teacher's own assigned students. */
  role: StudentProfileRole;
}

const statusLabels: Record<string, string> = {
  active: 'فعال',
  withdrawn: 'انصرافی',
  graduated: 'فارغ‌التحصیل',
};

const statusBadgeClass: Record<string, string> = {
  active: 'bg-paid/10 text-paid border-paid/25',
  withdrawn: 'bg-overdue/10 text-overdue border-overdue/25',
  graduated: 'bg-action-soft text-action border-action/25',
};

const attendanceStatusLabels: Record<string, string> = {
  present: 'حاضر',
  absent: 'غایب',
  late: 'تأخیر',
  excused: 'موجه',
};

const attendanceStatusClass: Record<string, string> = {
  present: 'bg-paid/10 text-paid border-paid/25',
  absent: 'bg-overdue/10 text-overdue border-overdue/25',
  late: 'bg-action-soft text-action border-action/25',
  excused: 'bg-ink/5 text-ink/60 border-line dark:bg-white/5 dark:text-paper/60 dark:border-white/10',
};

const termLabels: Record<string, string> = {
  first_term: 'نوبت اول',
  second_term: 'نوبت دوم',
};

function StudentAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '؟';
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-action-soft text-2xl font-semibold text-action dark:bg-action/15 dark:text-action-light">
      {initial}
    </span>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`badge ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------
// Mock-only data (رفتار/تشویق/اخطار). Seeded by studentId so a given
// student's sample stays stable within a session — no backend, no
// persistence, deliberately never sent over the network.
// ---------------------------------------------------------------------

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

interface MockNote {
  label: string;
  date: string;
  note: string;
}

const BEHAVIOR_NOTES = [
  { label: 'همکاری خوب در کار گروهی', note: 'در فعالیت‌های کلاسی مشارکت فعال داشت.' },
  { label: 'رعایت نظم کلاس', note: 'در طول جلسه نظم و آرامش کلاس را رعایت کرد.' },
  { label: 'نیاز به تمرکز بیشتر', note: 'چند بار حواسش در طول درس پرت شد.' },
];
const ENCOURAGEMENT_NOTES = [
  { label: 'تشویق بابت پیشرفت درسی', note: 'نسبت به نوبت قبل پیشرفت قابل‌توجهی داشته است.' },
  { label: 'تشویق بابت کمک به هم‌کلاسی', note: 'به یکی از هم‌کلاسی‌ها در حل تمرین کمک کرد.' },
];
const WARNING_NOTES = [
  { label: 'اخطار تأخیر مکرر', note: 'در دو جلسه اخیر با تأخیر وارد کلاس شده است.' },
];

function buildMockNotes(studentId: string, pool: { label: string; note: string }[], maxCount: number): MockNote[] {
  const seed = seedFromId(studentId);
  const count = pool.length > 0 ? (seed % (maxCount + 1)) : 0;
  const notes: MockNote[] = [];
  for (let i = 0; i < count; i++) {
    const item = pool[(seed + i * 7) % pool.length];
    const daysAgo = ((seed + i * 13) % 20) + 1;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    notes.push({ label: item.label, note: item.note, date: d.toISOString() });
  }
  return notes;
}

function MockSampleTag() {
  return (
    <span className="badge border-line bg-ink/5 text-ink/50 dark:border-white/10 dark:bg-white/5 dark:text-paper/50">
      نمونه
    </span>
  );
}

function MockNotesSection({
  title,
  notes,
  accentClass,
}: {
  title: string;
  notes: MockNote[];
  accentClass: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <SectionHeader title={title} />
        <MockSampleTag />
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-ink/40 dark:text-paper/40">موردی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${accentClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{n.label}</span>
                <span className="text-xs text-ink/40 dark:text-paper/40">{formatDate(n.date)}</span>
              </div>
              <p className="mt-1 text-ink/60 dark:text-paper/60">{n.note}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink/35 dark:text-paper/35">
        این بخش هنوز به سرور متصل نیست و صرفاً برای نمایش شکل نهایی صفحه است.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Real, backend-backed progress chart. No charting dependency needed
// for two/three bars — a lightweight inline bar chart keeps this
// component self-contained, matching how small the actual data is
// (at most two terms, at most a handful of subjects).
// ---------------------------------------------------------------------

function ProgressBars({ profile }: { profile: StudentProfileView }) {
  const terms = profile.assessments.reportSummary.terms;
  if (terms.length === 0) {
    return <p className="text-sm text-ink/40 dark:text-paper/40">هنوز نمره‌ای ثبت نشده است.</p>;
  }
  return (
    <div className="space-y-3">
      {terms.map((t) => (
        <div key={t.term}>
          <div className="mb-1 flex items-center justify-between text-xs text-ink/50 dark:text-paper/50">
            <span>{termLabels[t.term] ?? t.term}</span>
            <span className="tabular">{t.average != null ? `${t.average} از ۲۰` : '—'}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink/5 dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-action"
              style={{ width: `${t.average != null ? Math.min(100, (t.average / 20) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

export function StudentProfileModal({ studentId, open, onClose, role }: StudentProfileModalProps) {
  const adminQuery = useStudentProfile(role === 'admin' && open ? studentId : undefined);
  const teacherQuery = useTeacherStudentProfile(role === 'teacher' && open ? studentId : undefined);
  const query = role === 'admin' ? adminQuery : teacherQuery;

  const profile = query.data;

  const behaviorNotes = useMemo(
    () => (studentId ? buildMockNotes(studentId, BEHAVIOR_NOTES, 3) : []),
    [studentId],
  );
  const encouragementNotes = useMemo(
    () => (studentId ? buildMockNotes(studentId + ':enc', ENCOURAGEMENT_NOTES, 2) : []),
    [studentId],
  );
  const warningNotes = useMemo(
    () => (studentId ? buildMockNotes(studentId + ':warn', WARNING_NOTES, 1) : []),
    [studentId],
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" title="پروفایل دانش‌آموز">
      {query.isLoading ? (
        <ProfileSkeleton />
      ) : query.isError ? (
        <EmptyState
          message="خطا در بارگذاری پروفایل"
          description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
          action={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              تلاش مجدد
            </Button>
          }
        />
      ) : !profile ? null : (
        <div className="max-h-[75vh] space-y-6 overflow-y-auto pl-1">
          {/* Photo + info */}
          <div className="flex items-start gap-4">
            <StudentAvatar name={profile.student.fullName} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-bold text-ink dark:text-paper">{profile.student.fullName}</h4>
                <Badge className={statusBadgeClass[profile.student.status] ?? statusBadgeClass.active}>
                  {statusLabels[profile.student.status] ?? profile.student.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-ink/50 dark:text-paper/50">
                {profile.grade.title} · {profile.academicYear.title}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line dark:border-white/10">
            <div className="divide-y divide-line px-3 dark:divide-white/10">
              <InfoRow label="کد ملی" value={profile.student.nationalId || '—'} />
              <InfoRow
                label="تاریخ ثبت‌نام"
                value={profile.student.enrollmentDate ? formatDate(profile.student.enrollmentDate) : '—'}
              />
              <InfoRow label="مدرسه" value={profile.school.name} />
            </div>
          </div>

          {/* Parent phone numbers */}
          <div>
            <SectionHeader title="شماره والدین" />
            {profile.parents.length === 0 ? (
              <p className="text-sm text-ink/40 dark:text-paper/40">شماره‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-1.5">
                {profile.parents.map((p) => (
                  <li
                    key={p.id + p.type}
                    className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm dark:bg-white/5"
                  >
                    <span className="text-ink dark:text-paper">{p.fullName}</span>
                    <span className="tabular text-ink/60 dark:text-paper/60">{p.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Average + progress chart */}
          <div>
            <SectionHeader title="میانگین و روند پیشرفت" />
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="میانگین کل"
                value={
                  profile.assessments.reportSummary.overallAverage != null
                    ? `${profile.assessments.reportSummary.overallAverage} از ۲۰`
                    : '—'
                }
                accent="action"
              />
              <StatCard label="تعداد نمرات ثبت‌شده" value={String(profile.assessments.records.length)} />
            </div>
            <ProgressBars profile={profile} />
          </div>

          {/* Attendance */}
          <div>
            <SectionHeader title="سوابق حضور" />
            {profile.attendance.records.length === 0 ? (
              <p className="text-sm text-ink/40 dark:text-paper/40">سابقه‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-1.5">
                {profile.attendance.records.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm dark:bg-white/5"
                  >
                    <span className="tabular text-ink/70 dark:text-paper/70">{formatDate(a.date)}</span>
                    <Badge className={attendanceStatusClass[a.status] ?? attendanceStatusClass.excused}>
                      {attendanceStatusLabels[a.status] ?? a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Homework / assignments */}
          <div>
            <SectionHeader title="تکالیف" />
            {profile.homework.records.length === 0 ? (
              <p className="text-sm text-ink/40 dark:text-paper/40">تکلیفی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-1.5">
                {profile.homework.records.map((h) => (
                  <li key={h.id} className="rounded-lg bg-paper px-3 py-2 text-sm dark:bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink dark:text-paper">{h.title}</span>
                      <span className="text-xs text-ink/40 dark:text-paper/40">تحویل: {formatDate(h.dueDate)}</span>
                    </div>
                    {h.subjectTitle && (
                      <span className="mt-0.5 block text-xs text-ink/50 dark:text-paper/50">{h.subjectTitle}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mock-only sections: behavior / encouragement / warning */}
          <MockNotesSection
            title="رفتار"
            notes={behaviorNotes}
            accentClass="border-line bg-paper dark:border-white/10 dark:bg-white/5"
          />
          <MockNotesSection
            title="تشویق"
            notes={encouragementNotes}
            accentClass="border-paid/25 bg-paid/5"
          />
          <MockNotesSection
            title="اخطار"
            notes={warningNotes}
            accentClass="border-overdue/25 bg-overdue/5"
          />

          {profile.tuitionSummary.totalRemaining > 0 && role === 'admin' && (
            <p className="text-xs text-ink/40 dark:text-paper/40">
              مانده شهریه: {formatToman(profile.tuitionSummary.totalRemaining)}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
