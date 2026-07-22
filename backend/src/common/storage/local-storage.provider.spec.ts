import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  let tmpDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-storage-test-'));
    provider = new LocalStorageProvider({ baseDir: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a buffer under the given key', async () => {
    await provider.save('some-file.txt', Buffer.from('hello world'));

    const contents = await fs.readFile(path.join(tmpDir, 'some-file.txt'));
    expect(contents.toString()).toBe('hello world');
  });

  it('creates baseDir if it does not exist yet', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'dir');
    const nestedProvider = new LocalStorageProvider({ baseDir: nestedDir });

    await nestedProvider.save('file.txt', Buffer.from('data'));

    const contents = await fs.readFile(path.join(nestedDir, 'file.txt'));
    expect(contents.toString()).toBe('data');
  });

  it('overwrites an existing key silently', async () => {
    await provider.save('same-key.txt', Buffer.from('first'));
    await provider.save('same-key.txt', Buffer.from('second'));

    const contents = await fs.readFile(path.join(tmpDir, 'same-key.txt'));
    expect(contents.toString()).toBe('second');
  });

  it('deletes a previously-saved key', async () => {
    await provider.save('to-delete.txt', Buffer.from('bye'));
    const filePath = path.join(tmpDir, 'to-delete.txt');

    await expect(fs.access(filePath)).resolves.toBeUndefined();
    await provider.delete('to-delete.txt');
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('is a no-op when deleting a key that does not exist', async () => {
    await expect(provider.delete('never-existed.txt')).resolves.toBeUndefined();
  });

  it('strips directory components from the key before writing, keeping the write inside baseDir', async () => {
    await provider.save('../../etc/passwd', Buffer.from('should stay inside baseDir'));

    const written = path.join(tmpDir, 'passwd');
    await expect(fs.access(written)).resolves.toBeUndefined();

    const outside = path.resolve(tmpDir, '..', '..', 'etc', 'passwd');
    if (outside !== written) {
      await expect(fs.access(outside)).rejects.toThrow();
    }
  });

  it('refuses to delete a path that would escape baseDir', async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-storage-outside-'));
    const outsideFile = path.join(outsideDir, 'not-managed.txt');
    await fs.writeFile(outsideFile, 'should-not-be-touched');

    // basename() strips the traversal before it ever reaches fs.unlink,
    // so this exercises the same defense-in-depth path as save() above.
    await provider.delete(`../../../../${outsideFile}`);

    await expect(fs.access(outsideFile)).resolves.toBeUndefined();
    await fs.rm(outsideDir, { recursive: true, force: true });
  });
});
