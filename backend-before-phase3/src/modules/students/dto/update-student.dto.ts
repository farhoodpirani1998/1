import { IsOptional, IsUUID, IsEnum, IsString, MaxLength, IsDateString } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

export class UpdateStudentDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
