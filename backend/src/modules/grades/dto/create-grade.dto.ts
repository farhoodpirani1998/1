import { IsString, MaxLength } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @MaxLength(50)
  title: string;
}
