import { IsBoolean, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

// Generalizes the old UpdateUserStatusDto ({ isActive }) into the full
// set of fields a super_admin can edit on an existing user from
// UsersPage.tsx: activate/deactivate, plus fullName and phone. All
// optional so a caller can PATCH just one of them (e.g. the existing
// activate/deactivate toggle still only ever sends { isActive }).
//
// Deliberately excludes `role` and `schoolId` — changing what a user
// *is* (their tenant, their permission level) is a delete-and-recreate,
// not an edit, so those fields are never accepted here even if a client
// sends them (ValidationPipe's whitelist in main.ts strips anything not
// declared on this DTO).
export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string;
}
