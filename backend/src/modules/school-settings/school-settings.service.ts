import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { SchoolSettings } from './entities/school-settings.entity';
import { School } from '../schools/entities/school.entity';
import { Weekday } from '../timetable/entities/timetable-entry.entity';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';

// Postgres unique_violation, thrown when two concurrent "create the
// default row" attempts for the same school race each other -- same
// error code AuthService/TuitionPlansService already switch on for their
// own race conditions.
const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Phase 5M: School Settings.
 *
 * Exactly one SchoolSettings row per school (school_id is itself the
 * primary key -- see the entity/migration), created lazily the first
 * time a school_admin hits GET or PUT /settings rather than backfilled
 * for every existing school up front.
 *
 * Declares its own narrow repo for School (rather than importing
 * SchoolsModule/SchoolsService) purely to seed sensible defaults
 * (schoolName/address/phone) from the school's own record on first
 * creation -- same "narrow repo for a read-only lookup, not the whole
 * module" shape TimetableModule/HomeworkModule already use for
 * AcademicYear/Grade/Subject.
 */
@Injectable()
export class SchoolSettingsService {
  constructor(
    @InjectRepository(SchoolSettings)
    private readonly settingsRepo: Repository<SchoolSettings>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  /**
   * Returns the caller's school's settings, creating the default row
   * first if none exists yet. This is the only read path this module
   * exposes (GET /settings) -- there is deliberately no "does settings
   * exist" check exposed anywhere else, since a school_admin should never
   * see a 404 for a resource that always implicitly exists for their
   * school.
   */
  async findOrCreate(schoolId: string): Promise<SchoolSettings> {
    const existing = await this.settingsRepo.findOne({ where: { schoolId } });
    if (existing) {
      return existing;
    }
    return this.createDefault(schoolId);
  }

  /**
   * Partial update, merged onto the school's existing settings row --
   * creating the default row first if none exists yet, same
   * "findOrCreate before mutating" shape findOrCreate() itself uses for
   * reads. Only the fields present in the DTO are changed; everything
   * else (including fields never touched since the default row was
   * created) is left as-is.
   */
  async update(schoolId: string, dto: UpdateSchoolSettingsDto): Promise<SchoolSettings> {
    const settings = await this.findOrCreate(schoolId);

    Object.assign(settings, {
      schoolName: dto.schoolName ?? settings.schoolName,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : settings.logoUrl,
      address: dto.address !== undefined ? dto.address : settings.address,
      phone: dto.phone !== undefined ? dto.phone : settings.phone,
      email: dto.email !== undefined ? dto.email : settings.email,
      website: dto.website !== undefined ? dto.website : settings.website,
      timezone: dto.timezone ?? settings.timezone,
      language: dto.language ?? settings.language,
      currency: dto.currency ?? settings.currency,
      weekStartsOn: dto.weekStartsOn ?? settings.weekStartsOn,
      workingDays: dto.workingDays ?? settings.workingDays,
      passingScore: dto.passingScore ?? settings.passingScore,
      attendanceLateMinutes: dto.attendanceLateMinutes ?? settings.attendanceLateMinutes,
      tuitionReminderDays: dto.tuitionReminderDays ?? settings.tuitionReminderDays,
      smsEnabled: dto.smsEnabled ?? settings.smsEnabled,
      emailEnabled: dto.emailEnabled ?? settings.emailEnabled,
      primaryColor: dto.primaryColor !== undefined ? dto.primaryColor : settings.primaryColor,
      secondaryColor: dto.secondaryColor !== undefined ? dto.secondaryColor : settings.secondaryColor,
    });

    return this.settingsRepo.save(settings);
  }

  /**
   * Creates the default settings row for a school that doesn't have one
   * yet, seeding schoolName/address/phone from the school's own record
   * where available. Guards against the race of two concurrent first
   * requests both reaching here for the same school: the second insert
   * hits the table's primary key on school_id and fails with a unique
   * violation, at which point this just re-reads the row the other
   * request already created -- same "let the DB be the source of truth
   * for the race, re-read on conflict" shape AcademicYearsService's
   * partial unique index note documents for is_current.
   */
  private async createDefault(schoolId: string): Promise<SchoolSettings> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException('مدرسه یافت نشد');
    }

    const settings = this.settingsRepo.create({
      schoolId,
      schoolName: school.name,
      logoUrl: null,
      address: school.address ?? null,
      phone: school.phone ?? null,
      email: null,
      website: null,
      timezone: 'Asia/Tehran',
      language: 'fa',
      currency: 'IRR',
      weekStartsOn: Weekday.SATURDAY,
      workingDays: [
        Weekday.SATURDAY,
        Weekday.SUNDAY,
        Weekday.MONDAY,
        Weekday.TUESDAY,
        Weekday.WEDNESDAY,
      ],
      passingScore: 10,
      attendanceLateMinutes: 15,
      tuitionReminderDays: 7,
      smsEnabled: true,
      emailEnabled: false,
      primaryColor: null,
      secondaryColor: null,
    });

    try {
      return await this.settingsRepo.save(settings);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === POSTGRES_UNIQUE_VIOLATION) {
        const winner = await this.settingsRepo.findOne({ where: { schoolId } });
        if (winner) {
          return winner;
        }
      }
      throw err;
    }
  }
}
