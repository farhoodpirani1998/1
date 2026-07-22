import { ConfigService } from '@nestjs/config';
import { SmsProviderService } from './sms-provider.service';

function buildConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('SmsProviderService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('logs instead of sending, and never calls fetch, when unconfigured (unchanged no-op fallback)', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(buildConfigService({}));
    const result = await service.send({ to: '09120000000', text: 'hello' });

    expect(result).toEqual({ success: true, providerRef: 'unconfigured-noop' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends successfully and returns the provider message id (unchanged happy path)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'abc-123' }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
        SMS_SENDER_NUMBER: '10001',
      }),
    );

    const result = await service.send({ to: '09120000000', text: 'hello' });

    expect(result).toEqual({ success: true, providerRef: 'abc-123' });
    // Payload/headers shape is unchanged by the timeout work.
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      sender: '10001',
      receptor: '09120000000',
      message: 'hello',
    });
  });

  it('passes an AbortSignal to fetch, derived from SMS_REQUEST_TIMEOUT_MS', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
        SMS_REQUEST_TIMEOUT_MS: 5000,
      }),
    );

    await service.send({ to: '09120000000', text: 'hello' });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults the timeout to 10000ms when SMS_REQUEST_TIMEOUT_MS is unset', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
      }),
    );

    await service.send({ to: '09120000000', text: 'hello' });

    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
  });

  it('returns success: false, without throwing, when the request times out', async () => {
    const fetchSpy = jest.fn().mockImplementation(() => {
      const error = new Error('The operation was aborted');
      error.name = 'TimeoutError';
      return Promise.reject(error);
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
        SMS_REQUEST_TIMEOUT_MS: 5000,
      }),
    );

    await expect(service.send({ to: '09120000000', text: 'hello' })).resolves.toEqual({
      success: false,
    });
  });

  it('returns success: false, without throwing, on a non-timeout network error', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
      }),
    );

    await expect(service.send({ to: '09120000000', text: 'hello' })).resolves.toEqual({
      success: false,
    });
  });

  it('returns success: false when the gateway responds with a non-ok status (unchanged)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'gateway error',
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new SmsProviderService(
      buildConfigService({
        SMS_API_URL: 'https://gateway.example.com/send',
        SMS_API_KEY: 'test-key',
      }),
    );

    await expect(service.send({ to: '09120000000', text: 'hello' })).resolves.toEqual({
      success: false,
    });
  });
});
