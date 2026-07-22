import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider } from './storage-provider.interface';

/**
 * Constructor config for LocalStorageProvider. Deliberately just a
 * resolved directory path — this class never reads process.env or any
 * avatar-specific config itself (see StorageModule, which resolves the
 * actual directory and passes it in here). Keeps this provider reusable
 * for anything that wants local-disk storage, not just avatars.
 */
export interface LocalStorageProviderConfig {
  baseDir: string;
}

/**
 * Sprint 2 — Feature 1: Storage Core Abstraction.
 *
 * Pure storage mechanics — write bytes, delete a file, and the
 * filesystem safety checks around both. No knowledge of avatars, URLs,
 * MIME types, or filename generation: those stay in AvatarStorageService
 * (or whatever future caller uses this class).
 *
 * `key` is treated as an opaque, potentially-untrusted string: even
 * though today's only caller (AvatarStorageService) always generates
 * keys itself, this class doesn't rely on that — every key is
 * basename()'d and the resolved path re-checked against baseDir before
 * any filesystem call, so a key containing traversal sequences can never
 * escape baseDir. This is the same defense-in-depth AvatarStorageService
 * used to do inline; it now lives here since it's a storage-mechanics
 * concern, not a domain concern.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseDir: string;

  constructor(config: LocalStorageProviderConfig) {
    this.baseDir = config.baseDir;
  }

  /**
   * Resolves `key` against baseDir, stripping any directory component
   * first (path.basename) so a crafted key can never address a path
   * outside baseDir. Returns null (instead of throwing) if the resolved
   * path still doesn't land inside baseDir, so callers can decide how to
   * handle that (save() throws; delete() logs and no-ops, matching this
   * class's previous inline behavior).
   */
  private resolveSafePath(key: string): string | null {
    const filename = path.basename(key);
    const resolved = path.resolve(this.baseDir, filename);

    if (path.dirname(resolved) !== this.baseDir) {
      return null;
    }

    return resolved;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const resolved = this.resolveSafePath(key);
    if (!resolved) {
      throw new Error(`Refused to write outside storage directory: ${key}`);
    }

    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(resolved, buffer);
  }

  /**
   * Safe to call for a key that doesn't exist (ENOENT is swallowed) —
   * expected during normal replace/remove flows, not an error condition.
   */
  async delete(key: string): Promise<void> {
    const resolved = this.resolveSafePath(key);
    if (!resolved) {
      this.logger.warn(`Refused to delete outside storage directory: ${key}`);
      return;
    }

    try {
      await fs.unlink(resolved);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        this.logger.warn(`Failed to delete ${resolved}: ${err.message}`);
      }
    }
  }
}
