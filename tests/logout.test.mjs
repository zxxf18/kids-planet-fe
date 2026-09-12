import test from 'node:test';
import assert from 'node:assert/strict';
import { endSSOSession } from '../lib/logout.ts';

test('logout clears both the central SSO session and the business cookie', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({url, init});
    return url.startsWith('https:') ? Response.json({status: 'ok'}) : new Response(null, {status: 204});
  });
  await endSSOSession('/api/test/logout');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://sso.yebuluo.com.cn/api/logout');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[1].url, '/api/test/logout');
  assert.equal(calls[1].init.credentials, 'same-origin');
});

for (const failure of ['network', 'http', 'application']) {
  test('central logout ' + failure + ' failure is not reported as success, but still clears local session', async (t) => {
    let localCleared = false;
    t.mock.method(globalThis, 'fetch', async (url) => {
      if (!url.startsWith('https:')) { localCleared = true; return new Response(null, {status: 204}); }
      if (failure === 'network') throw new Error('offline');
      if (failure === 'http') return new Response('', {status: 500});
      return Response.json({status: 'error'});
    });
    await assert.rejects(endSSOSession('/api/test/logout'), /统一退出/);
    assert.equal(localCleared, true);
  });
}

test('failed local logout is not reported as success', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => url.startsWith('https:') ? Response.json({status: 'ok'}) : new Response('', {status: 500}));
  await assert.rejects(endSSOSession('/api/test/logout'), /退出/);
});
