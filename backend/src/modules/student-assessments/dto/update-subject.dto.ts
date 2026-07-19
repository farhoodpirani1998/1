import { IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @MaxLength(50)
  title: string;
}
