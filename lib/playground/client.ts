import type { AccessDecision } from './types';

export class PlaygroundApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'PlaygroundApiError';
    this.code = code;
    this.status = status;
  }
}

/** Dormant transport. Examples never import or depend on this client. */
export function createPlaygroundClient(config: { apiBaseUrl: string; requestTimeoutMs: number }) {
  async function request(path: string, options: RequestInit = {}): Promise<unknown> {
    if (!config.apiBaseUrl.trim()) {
      throw new PlaygroundApiError('not-configured', 'Custom analysis is not available yet. You can still explore the examples.');
    }
    let base: URL;
    try { base = new URL(config.apiBaseUrl); }
    catch { throw new PlaygroundApiError('configuration', 'The analysis service is not configured correctly.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) ||
        base.username || base.password || base.search || base.hash || base.pathname !== '/') {
      throw new PlaygroundApiError('configuration', 'The analysis service requires a valid HTTPS origin.');
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, config.requestTimeoutMs);
    try {
      const response = await fetch(new URL(path, base), {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: 'Your session has expired. Keep your inputs and return to the entry step before retrying.',
          403: 'This analysis is not permitted for your session.',
          413: 'These inputs exceed the size limit for this tool.',
          429: 'The usage limit has been reached. Please try again later.',
        };
        throw new PlaygroundApiError('http', messages[response.status] || 'The analysis service is unavailable. Please try again later.', response.status);
      }
      try { return await response.json(); }
      catch { throw new PlaygroundApiError('invalid-response', 'The analysis service returned an unreadable response.'); }
    } catch (error) {
      if (error instanceof PlaygroundApiError) throw error;
      if (options.signal?.aborted) throw error;
      throw new PlaygroundApiError('network', controller.signal.aborted
        ? 'The analysis service did not respond in time. Please retry.'
        : 'The analysis service could not be reached. The examples are still available.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }
  }

  return {
    async checkAccess(toolId: string, signal?: AbortSignal): Promise<AccessDecision> {
      const value = await request(`/api/v1/access?tool=${encodeURIComponent(toolId)}`, { signal });
      if (value && typeof value === 'object' && 'status' in value) {
        if (value.status === 'allowed') return { status: 'allowed' };
        if (value.status === 'verification-required' && 'method' in value && typeof value.method === 'string' && value.method) {
          return { status: 'verification-required', method: value.method };
        }
        if (value.status === 'denied' && 'message' in value && typeof value.message === 'string') {
          return { status: 'denied', message: value.message };
        }
      }
      throw new PlaygroundApiError('invalid-access', 'Access could not be confirmed. Please try again later.');
    },
    // Called only by an authorized workspace. The backend MUST independently authorize
    // every request and apply quotas, upload validation, and compute limits.
    run(toolId: string, input: FormData, signal?: AbortSignal) {
      return request(`/api/v1/tools/${encodeURIComponent(toolId)}/run`, { method: 'POST', body: input, signal });
    },
  };
}
