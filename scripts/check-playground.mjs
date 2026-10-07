import assert from 'node:assert/strict';
import { playgroundTools, getPlaygroundTool, toolHref, visibleModes } from '../data/playground.ts';
import { createPlaygroundClient, PlaygroundApiError } from '../lib/playground/client.ts';
import { playgroundConfig } from '../lib/playground/config.ts';

assert.equal(new Set(playgroundTools.map(tool => tool.id)).size, playgroundTools.length);
for (const tool of playgroundTools) {
  assert.match(tool.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(getPlaygroundTool(tool.id), tool);
  assert.equal(toolHref(tool.id), `/playground/${tool.id}`);
}
const crasdi = getPlaygroundTool('crasdi');
assert.equal(crasdi.modes.example, 'available');
assert.equal(crasdi.modes.interactive.status, 'planned');
assert.deepEqual(visibleModes(crasdi), ['example', 'interactive']);
assert.deepEqual(visibleModes({ ...crasdi, modes: { example: 'available', interactive: { status: 'hidden', runtime: 'server' } } }), ['example']);
assert.deepEqual(visibleModes({ ...crasdi, modes: { example: 'hidden', interactive: { status: 'available', runtime: 'browser' } } }), ['interactive']);
assert.deepEqual(visibleModes({ ...crasdi, modes: { example: 'hidden', interactive: { status: 'hidden', runtime: 'server' } } }), []);
assert.equal(getPlaygroundTool('missing-tool'), undefined);
assert.equal(playgroundConfig.apiBaseUrl, '');

const originalFetch = globalThis.fetch;
let calls = [];
let body = { status: 'allowed' };
let httpStatus = 200;
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify(body), { status: httpStatus, headers: { 'Content-Type': 'application/json' } });
};
try {
  const dormant = createPlaygroundClient(playgroundConfig);
  await assert.rejects(dormant.checkAccess('crasdi'), error => error instanceof PlaygroundApiError && error.code === 'not-configured');
  await assert.rejects(dormant.run('crasdi', new FormData()), /not available yet/);
  assert.equal(calls.length, 0, 'Disabled configuration must make zero network calls');
  for (const origin of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/api', 'https://example.com/?key=x', 'https://example.com/#x', 'not a url']) {
    await assert.rejects(createPlaygroundClient({ apiBaseUrl: origin, requestTimeoutMs: 100 }).checkAccess('crasdi'), error => error.code === 'configuration');
  }
  assert.equal(calls.length, 0);
  const client = createPlaygroundClient({ apiBaseUrl: 'https://analysis.example.com', requestTimeoutMs: 100 });
  assert.deepEqual(await client.checkAccess('crasdi'), { status: 'allowed' });
  assert.equal(calls[0].url, 'https://analysis.example.com/api/v1/access?tool=crasdi');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.body, undefined, 'Entry checks must send no visitor files');
  for (const decision of [{ status: 'verification-required', method: 'email' }, { status: 'denied', message: 'Daily usage limit reached.' }]) {
    body = decision;
    assert.deepEqual(await client.checkAccess('crasdi'), decision);
  }
  for (const malformed of [null, {}, { status: 'allowed-ish' }, { status: 'verification-required' }, { status: 'verification-required', method: '' }, { status: 'denied', message: 9 }]) {
    body = malformed;
    await assert.rejects(client.checkAccess('crasdi'), error => error.code === 'invalid-access');
  }
  for (const status of [401, 403, 413, 429, 503]) {
    httpStatus = status;
    await assert.rejects(client.checkAccess('crasdi'), error => error.status === status);
  }
  httpStatus = 200; body = { result: 'test' };
  const input = new FormData(); input.set('test', 'bounded input');
  assert.deepEqual(await client.run('a/b', input), body);
  const last = calls.at(-1);
  assert.equal(last.url, 'https://analysis.example.com/api/v1/tools/a%2Fb/run');
  assert.equal(last.options.body, input);
  assert.equal(last.options.method, 'POST');
  assert.equal(last.options.headers['Content-Type'], undefined, 'The browser must set the multipart boundary');
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new Error('Aborted'));
    else signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  });
  const short = createPlaygroundClient({ apiBaseUrl: 'https://analysis.example.com', requestTimeoutMs: 10 });
  await assert.rejects(short.checkAccess('crasdi'), /did not respond in time/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(short.checkAccess('crasdi', controller.signal), /Aborted/);
  console.log('PASS: tool modes, dormant configuration, access contracts, errors, limits, cancellation, and multipart transport.');
} finally { globalThis.fetch = originalFetch; }
