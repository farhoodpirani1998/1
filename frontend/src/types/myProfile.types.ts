// Sprint A3 — My Profile. Mirrors the backend's MyProfile shape (see
// UsersService.toMyProfile) returned by GET/PATCH /users/me — distinct
// from AuthUser (auth.types.ts), which stays a lightweight session
// model with only what's needed to render Topbar/Sidebar without an
// extra request. This is the fuller "My Profile" page's source of
// truth: phone/username/schoolName/createdAt live here, not on AuthUser.

import type { UserRole } from './auth.types';

export interface MyProfile {
  id: string;
  fullName: string;
  phone: string | null;
  // Schema-wide column, but only ever set by the student-provisioning
  // flow today (see AddUsernameToUsers migration) — no route lets any
  // role edit their own username, so this page only ever displays it.
  username: string | null;
  role: UserRole;
  isActive: boolean;
  schoolId: string | null;
  // Resolved server-side from schoolId (User itself only stores the
  // id) — null for super_admin/founder, same as schoolId.
  schoolName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}
