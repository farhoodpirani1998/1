import { IsOptional, IsUUID, IsEnum, IsString, MaxLength } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

export class UpdateStudentDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  // Explicitly nullable-via-null so a caller can clear a student's
  // section (e.g. after moving them out of a class); omitting the field
  // entirely leaves it unchanged -- same convention
  // UpdateHomeworkDto.attachmentUrl already uses.
  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;
}
