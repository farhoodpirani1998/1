import { ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStudentDto } from './create-student.dto';

// Sprint 1 (Bulk Import): each row is validated with the exact same
// rules as a single POST /students call (CreateStudentDto) — no
// separate/looser validation path for bulk rows. Capped at 500 rows per
// request so one request can't tie up the connection pool indefinitely;
// a school with more than 500 students to import in one go should split
// the file.
export class BulkImportStudentsDto {
  @ValidateNested({ each: true })
  @Type(() => CreateStudentDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  students: CreateStudentDto[];
}
