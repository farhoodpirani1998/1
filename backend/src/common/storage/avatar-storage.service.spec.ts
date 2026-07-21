import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AvatarStorageService, AVATAR_URL_PREFIX } from './avatar-storage.service';

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

describe('AvatarStorageService', () => {
  let tmpDir: string;
  let service: AvatarStorageService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avatar-storage-test-'));
    process.env.AVATAR_UPLOAD_DIR = tmpDir;
    service = new AvatarStorageService();
  });

  afterEach(async () => {
    delete process.env.AVATAR_UPLOAD_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes the file to disk and returns a URL under AVATAR_URL_PREFIX', async () => {
    const url = await service.save('user-1', makeFile());

    expect(url.startsWith(`${AVATAR_URL_PREFIX}/user-1-`)).toBe(true);
    expect(url.endsWith('.jpg')).toBe(true);

    const writtenPath = path.join(tmpDir, path.basename(url));
    const contents = await fs.readFile(writtenPath);
    expect(contents.toString()).toBe('fake-image-bytes');
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

  it('rejects an unsupported mime type', async () => {
    await expect(service.save('user-4', makeFile({ mimetype: 'application/pdf' }))).rejects.toThrow(
      /Unsupported avatar mime type/,
    );
  });

  it('removes a previously-saved file', async () => {
    const url = await service.save('user-5', makeFile());
    const writtenPath = path.join(tmpDir, path.basename(url));

    await expect(fs.access(writtenPath)).resolves.toBeUndefined();
    await service.remove(url);
    await expect(fs.access(writtenPath)).rejects.toThrow();
  });

  it('is a no-op when removing null', async () => {
    await expect(service.remove(null)).resolves.toBeUndefined();
  });

  it('is a no-op when removing a file that no longer exists', async () => {
    await expect(service.remove(`${AVATAR_URL_PREFIX}/already-gone.jpg`)).resolves.toBeUndefined();
  });

  it('refuses to delete a path that escapes the upload directory', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'avatar-storage-outside-'));
    const outsideFile = path.join(outside, 'not-an-avatar.jpg');
    await fs.writeFile(outsideFile, 'should-not-be-touched');

    // basename() strips any directory traversal from a crafted URL before
    // it ever reaches the filesystem call, so this exercises the same
    // defense-in-depth path even though avatarUrl is always
    // server-generated in practice.
    await service.remove(`${AVATAR_URL_PREFIX}/../../../../${outsideFile}`);

    await expect(fs.access(outsideFile)).resolves.toBeUndefined();
    await fs.rm(outside, { recursive: true, force: true });
  });
});
