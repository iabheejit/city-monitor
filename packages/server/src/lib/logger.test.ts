import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T14:30:05Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('info logs with timestamp and tag', () => {
    const log = createLogger('test');
    log.info('hello world');
    expect(console.log).toHaveBeenCalledWith(
      '2026-03-02T14:30:05Z [test] hello world',
    );
  });

  it('warn logs with WARN prefix', () => {
    const log = createLogger('test');
    log.warn('something bad');
    expect(console.warn).toHaveBeenCalledWith(
      '2026-03-02T14:30:05Z [test] WARN: something bad',
    );
  });

  it('error logs with ERROR prefix', () => {
    const log = createLogger('test');
    log.error('it broke');
    expect(console.error).toHaveBeenCalledWith(
      '2026-03-02T14:30:05Z [test] ERROR: it broke',
    );
  });

  it('error logs the error object on a separate line', () => {
    const log = createLogger('test');
    const err = new Error('details');
    log.error('it broke', err);
    expect(console.error).toHaveBeenCalledWith(
      '2026-03-02T14:30:05Z [test] ERROR: it broke',
    );
    expect(console.error).toHaveBeenCalledWith(err);
  });

  describe('fetch', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs successful fetch with status and duration', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(342);

      const log = createLogger('test');
      const response = await log.fetch('https://example.com/api');

      expect(response).toEqual({ ok: true, status: 200 });
      expect(console.log).toHaveBeenCalledWith(
        '2026-03-02T14:30:05Z [test] FETCH https://example.com/api → 200 (342ms)',
      );
    });

    it('logs non-ok response at warn level', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

      const log = createLogger('test');
      await log.fetch('https://example.com/api');

      expect(console.warn).toHaveBeenCalledWith(
        '2026-03-02T14:30:05Z [test] FETCH https://example.com/api → 500 (100ms)',
      );
    });

    it('logs network error and re-throws', async () => {
      const err = new Error('network down');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(8001);

      const log = createLogger('test');
      await expect(log.fetch('https://example.com/api')).rejects.toThrow('network down');

      expect(console.error).toHaveBeenCalledWith(
        '2026-03-02T14:30:05Z [test] FETCH https://example.com/api → ERROR (8001ms)',
      );
    });

    it('truncates long URLs at 80 chars', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);

      const longUrl = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current=temperature_2m,relative_humidity_2m';
      const truncated = longUrl.slice(0, 80) + '…';

      const log = createLogger('test');
      await log.fetch(longUrl);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(truncated),
      );
    });

    it('sanitizes token query params from logged URLs', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10);

      const log = createLogger('test');
      await log.fetch('https://api.waqi.info/map/bounds/?latlng=52,13,53,14&token=secret123');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('&token=***'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.not.stringContaining('secret123'),
      );
    });

    it('sanitizes key query params from logged URLs', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10);

      const log = createLogger('test');
      await log.fetch('https://api.tomtom.com/traffic?key=my-secret-key&bbox=1,2,3,4');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('?key=***'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.not.stringContaining('my-secret-key'),
      );
    });

    it('sanitizes bracket-encoded token params from logged URLs', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10);

      const log = createLogger('test');
      await log.fetch('https://example.com/api?param%5Btoken%5D=secret-value&other=ok');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('param%5Btoken%5D=***'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.not.stringContaining('secret-value'),
      );
    });

    it('passes init options through to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(10);

      const log = createLogger('test');
      const init = { headers: { 'User-Agent': 'Test/1.0' } };
      await log.fetch('https://example.com', init);

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', init);
    });
  });
});
