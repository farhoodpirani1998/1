import { Announcement } from '../entities/announcement.entity';

// school_admin-facing shape: the full record, minus the raw relation
// objects TypeORM would otherwise attach (school, createdBy) -- same
// "reshape, don't leak the ORM entity as-is" reasoning as toAttendanceView
// / toAssessmentView elsewhere.
export interface AnnouncementView {
  id: string;
  title: string;
  message: string;
  targetType: string;
  createdById: string | null;
  createdAt: Date;
}

export function toAnnouncementView(announcement: Announcement): AnnouncementView {
  return {
    id: announcement.id,
    title: announcement.title,
    message: announcement.message,
    targetType: announcement.targetType,
    createdById: announcement.createdById,
    createdAt: announcement.createdAt,
  };
}

// Recipient-facing shape (teacher/parent): deliberately narrower, same
// spirit as ParentAssessmentView -- no createdById (internal staff user
// id), no schoolId (the caller already knows which school they're in). A
// recipient only needs the title, message, audience, and when it was
// posted.
export interface RecipientAnnouncementView {
  id: string;
  title: string;
  message: string;
  targetType: string;
  createdAt: Date;
}

export function toRecipientAnnouncementView(announcement: Announcement): RecipientAnnouncementView {
  return {
    id: announcement.id,
    title: announcement.title,
    message: announcement.message,
    targetType: announcement.targetType,
    createdAt: announcement.createdAt,
  };
}
