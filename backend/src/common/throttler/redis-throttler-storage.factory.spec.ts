import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

// Mocked so this test never attempts a real TCP connection -- we're only
// verifying the service wires the same env-var connection config every
// other Redis consumer in this project uses (see redis-health.indicator.ts,
// app.module.ts's BullModule), hands that client to
// ThrottlerStorageRedisService, and closes it on module destroy.
const mockOn = jest.fn();
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockRedisInstances: Array<{ options: unknown }> = [];

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((options: unknown) => {
    const instance = { options, on: mockOn, quit: mockQuit };
    mockRedisInstances.push(instance);
    return instance;
  });
});

jest.mock('@nest-lab/throttler-storage-redis', () => ({
  ThrottlerStorageRedisService: jest.fn().mockImplementation((client: unknown) => ({ client })),
}));

import Redis from 'ioredis';
import { ThrottlerRedisStorageService } from './redis-throttler-storage.factory';

describe('ThrottlerRedisStorageService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisInstances.length = 0;
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('connects using REDIS_HOST/REDIS_PORT/REDIS_PASSWORD, matching every other Redis consumer', () => {
    process.env.REDIS_HOST = 'redis-test-host';
    process.env.REDIS_PORT = '6390';
    process.env.REDIS_PASSWORD = 'secret';

    new ThrottlerRedisStorageService();

    expect(Redis).toHaveBeenCalledWith({
      host: 'redis-test-host',
      port: 6390,
      password: 'secret',
    });
  });

  it('falls back to localhost:6379 and no password when unset, same as RedisHealthIndicator', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;

    new ThrottlerRedisStorageService();

    expect(Redis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
  });

  it('registers an error listener so a connection drop cannot crash the process', () => {
    new ThrottlerRedisStorageService();

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('exposes a `storage` built from the same client handed to ThrottlerStorageRedisService', () => {
    const service = new ThrottlerRedisStorageService();

    expect(ThrottlerStorageRedisService).toHaveBeenCalledWith(mockRedisInstances[0]);
    expect(service.storage).toBeDefined();
  });

  it('calls quit() on the Redis client when the module is destroyed', async () => {
    const service = new ThrottlerRedisStorageService();

    await service.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalledTimes(1);
  });

  it('does not throw if quit() rejects during shutdown', async () => {
    mockQuit.mockRejectedValueOnce(new Error('connection already closed'));
    const service = new ThrottlerRedisStorageService();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
