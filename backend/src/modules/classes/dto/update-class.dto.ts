import { IsString, MaxLength, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  teacherName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
