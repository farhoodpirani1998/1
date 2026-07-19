import { IsString, MaxLength } from 'class-validator';

export class UpdateGradeDto {
  @IsString()
  @MaxLength(50)
  title: string;
}
