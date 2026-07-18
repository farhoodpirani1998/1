import { IsString, IsPhoneNumber, MaxLength, IsOptional } from 'class-validator';

// Every field optional, same hand-written "partial DTO" convention as
// UpdateStudentDto / UpdateTimetableEntryDto (no @nestjs/mapped-types
// dependency in this codebase). GuardiansService.update() merges
// whichever fields are given onto the existing row.
export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsPhoneNumber('IR')
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;
}
