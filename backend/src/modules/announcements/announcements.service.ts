import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Announcement, AnnouncementTargetType } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

// Sprint A.4: one announcement paired with the calling user's own read
// status -- returned by findForAudienceWithReadStatus() below, never
// persisted as-is. Kept as a plain interface (not an entity), same shape
// AnnouncementView/RecipientAnnouncementView already use for read-facing
// projections.
export interface AnnouncementWithReadStatus {
  announcement: Announcement;
  isRead: boolean;
  readAt: Date | null;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(AnnouncementRead)
    private readonly announcementReadRepo: Repository<AnnouncementRead>,
  ) {}

  /**
   * Posts a new announcement for the caller's own school. schoolId and
   * createdById are always taken from the authenticated caller (the
   * controller passes them from @CurrentUser()), never accepted from the
   * request body -- same "derive tenant scope from the token, not the
   * payload" shape every other create() in this codebase follows.
   */
  async create(
    dto: CreateAnnouncementDto,
    schoolId: string,
    createdById: string,
  ): Promise<Announcement> {
    const announcement = this.announcementRepo.create({
      schoolId,
      title: dto.title,
      message: dto.message,
      targetType: dto.targetType,
      createdById,
    });
    return this.announcementRepo.save(announcement);
  }

  /**
   * school_admin-facing: every announcement posted in their own school,
   * regardless of targetType, most recent first.
   */
  async findAllForSchool(schoolId: string): Promise<Announcement[]> {
    return this.announcementRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Tenant check mirrors AssessmentsService.assertStudentInSchool()'s
   * shape: fetched by id + schoolId together, so a wrong-tenant id 404s
   * exactly like a nonexistent one -- a school_admin can never learn
   * "that id exists, just not here" from the response.
   */
  async delete(id: string, schoolId: string): Promise<void> {
    const announcement = await this.announcementRepo.findOne({ where: { id, schoolId } });
    if (!announcement) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    await this.announcementRepo.remove(announcement);
  }

  /**
   * school_admin-facing single-record read, for the announcement detail
   * page linked from Global Search results. Same (id, schoolId)-scoped
   * 404 shape as delete() above.
   */
  async findOneForSchool(id: string, schoolId: string): Promise<Announcement> {
    const announcement = await this.announcementRepo.findOne({ where: { id, schoolId } });
    if (!announcement) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    return announcement;
  }

  /**
   * Recipient-facing read (teacher/parent): announcements targeted at
   * 'all' or the caller's own audience, scoped to their own school --
   * never a cross-school row, never an announcement aimed at a different
   * audience. `audience` is fixed per call site (TeacherController always
   * passes TEACHERS, ParentController always passes PARENTS), never
   * accepted from the request, so a caller can't widen their own view by
   * passing a different targetType.
   */
  async findForAudience(
    schoolId: string,
    audience: AnnouncementTargetType,
  ): Promise<Announcement[]> {
    return this.announcementRepo.find({
      where: { schoolId, targetType: In([AnnouncementTargetType.ALL, audience]) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Sprint A.4: same (schoolId, audience)-scoped visibility rule as
   * findForAudience() above, but for a single announcement by id --
   * backs markAsRead()'s "can only mark an announcement they can
   * actually see" check. Split the same way findOneForSchool()/delete()
   * already split existence vs. tenant ownership: a wrong-school id 404s
   * (looks exactly like a nonexistent one), an in-school announcement
   * aimed at a different audience (e.g. 'parents' for a teacher caller)
   * 403s instead -- the caller can tell "this exists but isn't for you"
   * from "this doesn't exist", same as every other audience-scoped read
   * in this codebase never widening what a caller can already see.
   */
  private async findVisibleForAudience(
    id: string,
    schoolId: string,
    audience: AnnouncementTargetType,
  ): Promise<Announcement> {
    const announcement = await this.announcementRepo.findOne({ where: { id, schoolId } });
    if (!announcement) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    if (announcement.targetType !== AnnouncementTargetType.ALL && announcement.targetType !== audience) {
      throw new ForbiddenException('این اطلاعیه برای شما نیست');
    }
    return announcement;
  }

  /**
   * Sprint A.4: marks one announcement as read for one user. Visibility
   * is re-checked via findVisibleForAudience() above every call -- a
   * caller can never mark-as-read something outside their own audience
   * or school, even if they already know its id.
   *
   * Upserts on (announcementId, userId) the same way
   * HomeworkSubmissionService.recordSubmission() upserts on
   * (homeworkId, studentId) -- but unlike that method, a repeat call is
   * a no-op rather than a correction: readAt is fixed at first read (see
   * AnnouncementRead's own header comment), so calling this again for an
   * already-read announcement simply returns the existing row unchanged
   * instead of bumping its timestamp.
   */
  async markAsRead(
    id: string,
    userId: string,
    schoolId: string,
    audience: AnnouncementTargetType,
  ): Promise<AnnouncementRead> {
    const announcement = await this.findVisibleForAudience(id, schoolId, audience);

    const existing = await this.announcementReadRepo.findOne({
      where: { announcementId: announcement.id, userId },
    });
    if (existing) {
      return existing;
    }

    const read = this.announcementReadRepo.create({
      announcementId: announcement.id,
      userId,
      schoolId,
    });
    return this.announcementReadRepo.save(read);
  }

  /**
   * Sprint A.4: findForAudience() above, paired with the calling user's
   * own read status for each announcement returned. One extra query
   * (announcement_reads rows for this user, restricted to the ids just
   * fetched) rather than N+1 -- same "one list read, statuses derived
   * from it" shape HomeworkSubmissionService.getSummary() already uses
   * for its own per-status breakdown.
   *
   * findForAudience() itself is left completely unchanged (and still
   * used as-is by ParentController/AnnouncementsController) -- this is
   * an additive read path, not a modification of the existing one.
   */
  async findForAudienceWithReadStatus(
    schoolId: string,
    audience: AnnouncementTargetType,
    userId: string,
  ): Promise<AnnouncementWithReadStatus[]> {
    const announcements = await this.findForAudience(schoolId, audience);
    if (announcements.length === 0) {
      return [];
    }

    const reads = await this.announcementReadRepo.find({
      where: { userId, announcementId: In(announcements.map((a) => a.id)) },
    });
    const readByAnnouncementId = new Map(reads.map((r) => [r.announcementId, r]));

    return announcements.map((announcement) => {
      const read = readByAnnouncementId.get(announcement.id);
      return {
        announcement,
        isRead: !!read,
        readAt: read?.readAt ?? null,
      };
    });
  }
}
