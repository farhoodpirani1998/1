import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

// Sprint P1 — Universal Avatar System.
//
// Single-VM deployment today (see docker-compose.yml -- Postgres + Redis,
// no object storage service), so avatars live on local disk under a
// dedicated volume, same "reference on the row, bytes on disk" split
// StudentDocument.fileUrl already established for documents. Isolated
// here (not inlined into UsersService) so a future move to S3-compatible
// storage only means swapping this one class -- the controller/service
// call sites (`save`/`remove`) wouldn't need to change shape.

// Closed allow-list, not a wildcard "any image/*" check -- keeps the
// written file extension (and therefore what a browser will ever try to
// render/execute from this directory) limited to formats actually meant
// for profile photos.
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const AVATAR_ALLOWED_MIME_TYPES = Object.keys(MIME_TO_EXTENSION);

// 2MB -- generous enough for a profile photo, small enough that repeated
// uploads can't meaningfully fill the disk or degrade upload latency.
export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

// Mounted by main.ts as a static route -- see `app.use(AVATAR_URL_PREFIX, ...)`.
// Kept here (not duplicated as a literal in main.ts) so the value stored
// on `users.avatar_url` and the route that serves it can never drift
// apart.
export const AVATAR_URL_PREFIX = '/uploads/avatars';

// Shared by this service and main.ts's static route registration, so the
// directory files are written to and the directory served over HTTP can
// never drift apart. Reads process.env directly (no ConfigService
// indirection), same style JwtStrategy/main.ts already use for
// infra-level settings. Defaults to a folder relative to the process
// cwd, matching where migrations/dist already resolve relative paths
// from.
export function resolveAvatarUploadDir(): string {
  return path.resolve(process.env.AVATAR_UPLOAD_DIR ?? 'uploads/avatars');
}

@Injectable()
export class AvatarStorageService {
  private readonly logger = new Logger(AvatarStorageService.name);

  private readonly uploadDir = resolveAvatarUploadDir();

  /**
   * Writes the given (already validated by the controller's
   * FileInterceptor fileFilter/limits) file to disk under a fully
   * server-generated filename and returns the relative URL to store on
   * `User.avatarUrl`.
   *
   * The filename is never derived from the client-supplied original
   * name -- only from `userId` (which is always the token's own id, see
   * UsersMeController) plus a random suffix. This rules out path
   * traversal via a crafted filename and busts any browser/CDN cache of
   * a previous avatar at the same user.
   */
  async save(userId: string, file: Express.Multer.File): Promise<string> {
    const extension = MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      // Defense in depth -- the controller's fileFilter already rejects
      // anything outside AVATAR_ALLOWED_MIME_TYPES before multer ever
      // hands us a file, so this should be unreachable in practice.
      throw new Error(`Unsupported avatar mime type: ${file.mimetype}`);
    }

    await fs.mkdir(this.uploadDir, { recursive: true });

    const filename = `${userId}-${randomUUID()}.${extension}`;
    const destination = path.join(this.uploadDir, filename);
    await fs.writeFile(destination, file.buffer);

    return `${AVATAR_URL_PREFIX}/${filename}`;
  }

  /**
   * Deletes the file a previously-stored avatar URL points at, if any.
   * Safe to call with `null` (nothing to do) and safe to call for a file
   * that's already gone (ENOENT is swallowed) -- both are expected during
   * normal replace/remove flows, not error conditions.
   */
  async remove(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) {
      return;
    }

    const filename = path.basename(avatarUrl);
    const resolved = path.resolve(this.uploadDir, filename);

    // avatarUrl is always one this service generated itself (see save()
    // above), never client-supplied -- this check is defense in depth
    // against ever unlinking a path outside the upload directory, not a
    // trust boundary this method expects to actually be crossed.
    if (path.dirname(resolved) !== this.uploadDir) {
      this.logger.warn(`Refused to delete avatar outside upload dir: ${avatarUrl}`);
      return;
    }

    try {
      await fs.unlink(resolved);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        this.logger.warn(`Failed to delete avatar file ${resolved}: ${err.message}`);
      }
    }
  }
}
