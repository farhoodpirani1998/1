import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { StudentDocumentType } from '../entities/student-document.entity';

export class CreateStudentDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsEnum(StudentDocumentType)
  documentType: StudentDocumentType;

  // Phase 5I does not implement file storage/upload -- the caller supplies
  // the already-hosted location of the file, same "store the reference,
  // not the bytes" shape as Payment.referenceNumber. Validated as a URL
  // (require_tld: false so http://localhost/... URLs used in dev/tests
  // still pass) rather than an opaque string, since this is meant to be a
  // fetchable location.
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2000)
  fileUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
