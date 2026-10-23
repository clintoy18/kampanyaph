import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setCsrf } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrf('');
});

describe('API client', () => {
  it('sends cookie credentials and CSRF token on writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    setCsrf('test-csrf');
    await api('/businesses', { method: 'POST', body: { name: 'Sample' } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/businesses'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf',
          'X-Kampanya-Request': '1',
        }),
      }),
    );
  });
  it('maps server errors to a visible message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You cannot do that' } }),
            { status: 403 },
          ),
        ),
    );
    await expect(api('/businesses')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You cannot do that',
    });
  });
});
