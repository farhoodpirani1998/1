import { BadRequestException, FileTypeValidator, HttpStatus, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_SIZE_BYTES } from './avatar-storage.service';

// Passed to FileInterceptor('avatar', avatarMulterOptions()) on
// UsersMeController's upload route.
//
// memoryStorage (not diskStorage) deliberately -- AvatarStorageService
// owns all filesystem access (upload dir resolution, filename
// generation, old-file cleanup) in one place, same "one class, one
// concern" reasoning the rest of this codebase's services follow.
//
// `limits.fileSize` here is a coarse backstop only (5x the real 2MB
// business limit), not the authoritative check -- multer raises its own
// error object for an exceeded limit, which is not an HttpException and
// would surface as a generic 500 via AllExceptionsFilter rather than a
// proper 400. The authoritative size/type validation is
// `avatarFileValidationPipe()` (ParseFilePipe, applied to the
// `@UploadedFile()` parameter in the controller), which Nest guarantees
// throws a real BadRequestException. This backstop only exists so an
// abusive multi-hundred-MB request can't be buffered into memory in full
// before that pipe gets a chance to reject it.
const MULTER_HARD_SIZE_BACKSTOP_BYTES = AVATAR_MAX_SIZE_BYTES * 5;

export function avatarMulterOptions(): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: MULTER_HARD_SIZE_BACKSTOP_BYTES,
    },
    // Early, cheap rejection of an obviously-wrong content type before
    // multer finishes buffering it -- redundant with (but cheaper than)
    // avatarFileValidationPipe()'s FileTypeValidator below, which remains
    // the authoritative check.
    fileFilter: (_req, file, callback) => {
      if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        callback(
          new BadRequestException('فرمت تصویر پشتیبانی نمی‌شود. فرمت‌های مجاز: JPG، PNG، WEBP'),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

// The authoritative validator for the uploaded avatar -- applied via
// `@UploadedFile(avatarFileValidationPipe())` on the controller
// parameter. Runs after FileInterceptor has already extracted the file,
// so both validators here reliably throw a real BadRequestException
// (Nest's own behavior, not something this project has to reimplement),
// unlike a raw multer limit error.
//
// `fileIsRequired: true` is what makes a request with no `avatar` part
// at all a 400 instead of reaching the controller with `file`
// undefined.
export function avatarFileValidationPipe(): ParseFilePipe {
  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: AVATAR_MAX_SIZE_BYTES }),
      // AVATAR_ALLOWED_MIME_TYPES is a short closed list -- joined into an
      // alternation regex rather than hand-writing a second, parallel
      // pattern that could drift from that list.
      new FileTypeValidator({ fileType: new RegExp(AVATAR_ALLOWED_MIME_TYPES.join('|')) }),
    ],
    fileIsRequired: true,
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  });
}
