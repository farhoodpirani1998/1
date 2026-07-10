import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Announcement, AnnouncementTargetType } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
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
}
