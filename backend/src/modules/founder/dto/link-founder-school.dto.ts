import { IsUUID } from 'class-validator';

// super_admin-only: attaches an existing founder-role user to an existing
// school. Mirrors LinkParentDto's shape (modules/parent/dto) — a plain
// pair of ids, validated as UUIDs, with the "does this user actually have
// this role" / "does the school exist" checks left to FounderService,
// same as ParentService.link().
export class LinkFounderSchoolDto {
  @IsUUID()
  founderId: string;

  @IsUUID()
  schoolId: string;
}
