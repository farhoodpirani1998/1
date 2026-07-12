// Centralized React Query key registry.
//
// RULE: no hook or component builds a queryKey array by hand — every
// key used in useQuery/useInvalidateQueries/setQueryData comes from
// here. This is what makes invalidation reliable: a mutation can
// invalidate `queryKeys.reports.all()` without knowing every exact
// param combination reports.ts ever queried with.
//
// Convention: every domain exposes
//   all()      -> root key for the whole domain (broadest invalidation)
//   lists()    -> root key for "list" queries within the domain
//   list(params) -> one specific filtered list
//   detail(id) -> one specific entity
// Domains that are single-shot (no list/detail split) just expose the
// keys that make sense for them (e.g. reports).

import type { QueryStudentsParams } from '../api/students.api';
import type { QueryInstallmentsParams } from '../api/tuition.api';

export const queryKeys = {
  students: {
    all: () => ['students'] as const,
    lists: () => [...queryKeys.students.all(), 'list'] as const,
    list: (params?: QueryStudentsParams) => [...queryKeys.students.lists(), params ?? {}] as const,
    details: () => [...queryKeys.students.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.students.details(), id] as const,
  },

  grades: {
    all: () => ['grades'] as const,
    list: () => [...queryKeys.grades.all(), 'list'] as const,
  },

  academicYears: {
    all: () => ['academicYears'] as const,
    list: () => [...queryKeys.academicYears.all(), 'list'] as const,
  },

  schools: {
    all: () => ['schools'] as const,
    list: () => [...queryKeys.schools.all(), 'list'] as const,
  },

  users: {
    all: () => ['users'] as const,
    list: () => [...queryKeys.users.all(), 'list'] as const,
  },

  tuitionPlans: {
    all: () => ['tuitionPlans'] as const,
    detail: (id: string) => [...queryKeys.tuitionPlans.all(), 'detail', id] as const,
  },

  installments: {
    all: () => ['installments'] as const,
    lists: () => [...queryKeys.installments.all(), 'list'] as const,
    list: (params?: QueryInstallmentsParams) => [...queryKeys.installments.lists(), params ?? {}] as const,
  },

  payments: {
    all: () => ['payments'] as const,
    list: (studentId?: string) => [...queryKeys.payments.all(), 'list', studentId ?? null] as const,
  },

  reports: {
    all: () => ['reports'] as const,
    overdueSummary: () => [...queryKeys.reports.all(), 'overdueSummary'] as const,
    monthlyIncome: (year: number, month: number) => [...queryKeys.reports.all(), 'monthlyIncome', year, month] as const,
    debtorStudents: () => [...queryKeys.reports.all(), 'debtorStudents'] as const,
    studentStatement: (studentId: string) => [...queryKeys.reports.all(), 'studentStatement', studentId] as const,
  },

  analytics: {
    all: () => ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all(), 'dashboard'] as const,
  },

  parent: {
    all: () => ['parent'] as const,
    students: () => [...queryKeys.parent.all(), 'students'] as const,
    tuition: (studentId: string) => [...queryKeys.parent.all(), 'tuition', studentId] as const,
    installments: (studentId: string) => [...queryKeys.parent.all(), 'installments', studentId] as const,
    payments: (studentId: string) => [...queryKeys.parent.all(), 'payments', studentId] as const,
    announcements: () => [...queryKeys.parent.all(), 'announcements'] as const,
  },
} as const;
