import { AvatarStorageService, AVATAR_URL_PREFIX } from './avatar-storage.service';
import { StorageProvider } from './storage-provider.interface';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'avatar',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    size: 17,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

/**
 * In-memory fake StorageProvider — AvatarStorageService is tested in
 * isolation from any real filesystem now that storage mechanics live in
 * LocalStorageProvider (see local-storage.provider.spec.ts for those
 * tests). This fake exists purely to observe what AvatarStorageService
 * asks the provider to do (key/buffer on save, key on delete), not to
 * re-verify filesystem safety — that's the provider's own contract.
 */
class FakeStorageProvider implements StorageProvider {
  files = new Map<string, Buffer>();

  async save(key: string, buffer: Buffer): Promise<void> {
    this.files.set(key, buffer);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

describe('AvatarStorageService', () => {
  let provider: FakeStorageProvider;
  let service: AvatarStorageService;

  beforeEach(() => {
    provider = new FakeStorageProvider();
    service = new AvatarStorageService(provider);
  });

  it('writes the file via the provider and returns a URL under AVATAR_URL_PREFIX', async () => {
    const url = await service.save('user-1', makeFile());

    expect(url.startsWith(`${AVATAR_URL_PREFIX}/user-1-`)).toBe(true);
    expect(url.endsWith('.jpg')).toBe(true);

    const key = url.slice(`${AVATAR_URL_PREFIX}/`.length);
    expect(provider.files.get(key)?.toString()).toBe('fake-image-bytes');
  });

  it('derives the extension from mimetype, never from the client-supplied filename', async () => {
    const url = await service.save(
      'user-2',
      makeFile({ mimetype: 'image/png', originalname: '../../etc/passwd.exe' }),
    );

    expect(url.endsWith('.png')).toBe(true);
    expect(url).not.toContain('passwd');
    expect(url).not.toContain('..');
  });

  it('generates a different filename on every call, even for the same user', async () => {
    const first = await service.save('user-3', makeFile());
    const second = await service.save('user-3', makeFile());

    expect(first).not.toBe(second);
  });

  it('rejects an unsupported mime type without calling the provider', async () => {
    await expect(service.save('user-4', makeFile({ mimetype: 'application/pdf' }))).rejects.toThrow(
      /Unsupported avatar mime type/,
    );
    expect(provider.files.size).toBe(0);
  });

  it('removes a previously-saved file via the provider', async () => {
    const url = await service.save('user-5', makeFile());
    const key = url.slice(`${AVATAR_URL_PREFIX}/`.length);

    expect(provider.files.has(key)).toBe(true);
    await service.remove(url);
    expect(provider.files.has(key)).toBe(false);
  });

  it('is a no-op when removing null (never calls the provider)', async () => {
    const deleteSpy = jest.spyOn(provider, 'delete');
    await expect(service.remove(null)).resolves.toBeUndefined();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('passes only the basename of the URL as the key, stripping any path segments', async () => {
    const deleteSpy = jest.spyOn(provider, 'delete');
    await service.remove(`${AVATAR_URL_PREFIX}/../../../../etc/passwd.jpg`);
    expect(deleteSpy).toHaveBeenCalledWith('passwd.jpg');
  });
});
