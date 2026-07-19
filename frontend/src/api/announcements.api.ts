import { api } from '../lib/api';

// Admin-facing announcement read (AnnouncementsController on the
// backend — GET /announcements/:id). Mirrors AnnouncementView 1:1 (see
// backend/src/modules/announcements/dto/announcement-view.dto.ts).
// Distinct from the recipient-facing shape teacher/parent portals use
// (RecipientAnnouncementView) — this one includes createdById.
export interface AnnouncementDetail {
  id: string;
  title: string;
  message: string;
  targetType: string;
  createdById: string | null;
  createdAt: string;
}

// GET /announcements/:id — @Roles('school_admin','accountant','staff').
// The announcement detail page linked from Global Search results.
export function getAnnouncementDetail(id: string) {
  return api.get<AnnouncementDetail>(`/announcements/${id}`);
}
