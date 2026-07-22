/**
 * Sprint 2 — Feature 1: Storage Core Abstraction.
 *
 * Deliberately generic — this interface must never gain avatar-specific,
 * URL-specific, or MIME-specific members. Anything domain-shaped (what a
 * key *means*, what extension a file gets, what URL a caller builds from
 * it) belongs in the calling service (e.g. AvatarStorageService), not
 * here. A future S3StorageProvider must be able to implement this exact
 * interface with no changes to it.
 *
 * `key` is an opaque, caller-generated identifier (e.g. a filename) —
 * providers never construct or interpret it, only use it to address
 * bytes.
 */
export interface StorageProvider {
  /**
   * Writes `buffer` under `key`. Overwrites silently if `key` already
   * exists (callers that care about collisions are responsible for
   * generating collision-resistant keys themselves).
   */
  save(key: string, buffer: Buffer): Promise<void>;

  /**
   * Deletes whatever is stored under `key`. Must be a no-op (not an
   * error) when `key` doesn't exist — callers rely on delete-if-present
   * semantics for replace/remove flows.
   */
  delete(key: string): Promise<void>;
}

// DI token — StorageProvider is an interface (erased at runtime), so
// Nest needs a concrete token to bind an implementation to. Consumers
// inject via `@Inject(STORAGE_PROVIDER)`.
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
