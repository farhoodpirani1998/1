import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { resolveAvatarUploadDir } from './avatar-storage.service';

/**
 * Sprint 2 — Feature 1: Storage Core Abstraction.
 *
 * Binds STORAGE_PROVIDER to a concrete implementation based on
 * STORAGE_DRIVER (see env.validation.ts — only 'local' is valid today).
 * Only AvatarStorageService's underlying directory is wired in yet
 * (there's exactly one caller of storage today); adding a second
 * caller with its own base directory just means giving it its own
 * factory/token pair, not changing this one's shape.
 *
 * No S3 branch yet — the `default: throw` case is what makes an
 * unsupported STORAGE_DRIVER value fail loudly at boot, same
 * fail-loud-not-silently-wrong pattern as env.validation.ts.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const driver = configService.get<string>('STORAGE_DRIVER', 'local');

        switch (driver) {
          case 'local':
            // resolveAvatarUploadDir() is shared with main.ts's static
            // route registration — using it here too means the
            // directory this provider writes to and the directory
            // served over HTTP can never drift apart.
            return new LocalStorageProvider({ baseDir: resolveAvatarUploadDir() });
          default:
            throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
        }
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
