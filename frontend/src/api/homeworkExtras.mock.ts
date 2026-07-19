// ---------------------------------------------------------------------
// Homework "extended fields" — TEMPORARY MOCK.
//
// Requested in review of the teacher-portal homework form: ساعت تحویل،
// بارگذاری فایل، حداکثر حجم/نوع فایل مجاز، امتیاز، نمایش برای
// والدین/دانش‌آموز، انتشار زمان‌بندی‌شده. None of these exist on the
// real Homework entity / CreateHomeworkDto / UpdateHomeworkDto yet —
// adding them for real needs a migration + DTO + service change on the
// backend, out of scope for this pass (frontend-only, per review).
//
// Kept in an in-memory Map, keyed by the real homework id returned from
// POST/PUT /teacher/homework — so each extras record "attaches" to a
// real, backend-persisted homework row without ever being sent to the
// backend itself (it would be rejected: main.ts's ValidationPipe runs
// with forbidNonWhitelisted: true). Lost on page reload, same tradeoff
// as every other *.mock.ts file in this folder — see
// parentPasswordReset.mock.ts's header comment for the precedent this
// follows.
//
// TODO(backend): once real columns/DTO fields exist for these, delete
// this file and fold HomeworkExtras into HomeworkView / Create·/Update-
// HomeworkInput directly. Every call site already reads/writes through
// hooks/useHomeworkExtras.ts, so only that hook file and this one need
// to change.
// ---------------------------------------------------------------------

import { DEFAULT_HOMEWORK_EXTRAS, type HomeworkExtras } from '../types/homeworkExtras.types';

const MOCK_NETWORK_DELAY_MS = 250;

const store = new Map<string, HomeworkExtras>();

export async function getHomeworkExtras(homeworkId: string): Promise<HomeworkExtras> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return store.get(homeworkId) ?? DEFAULT_HOMEWORK_EXTRAS;
}

export async function saveHomeworkExtras(homeworkId: string, extras: HomeworkExtras): Promise<HomeworkExtras> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  store.set(homeworkId, extras);
  return extras;
}
