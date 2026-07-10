import { IsUUID } from 'class-validator';

export class LinkParentDto {
  @IsUUID()
  parentId: string;

  @IsUUID()
  studentId: string;
}
