import { IsString, MaxLength, IsUUID } from 'class-validator';

export class CreateClassDto {
  @IsUUID()
  gradeId: string;

  @IsUUID()
  academicYearId: string;

  @IsString()
  @MaxLength(50)
  title: string;
}
