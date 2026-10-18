import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseAuth } from '../auth.mjs';

const config = {
  url: 'https://auth-provider.fixture.supabase.co',
  publishableKey: 'sb_publishable_AUTH_TEST_FIXTURE',
  appOrigin: 'https://member.fixture.invalid',
  authEmailEnabled: true
};
const credentials = { email: 'member@fixture.invalid', password: 'Test-Password-For-Auth-1234' };

test('hosted auth adapter reports invalid credentials, expired sessions, outages and rate limits distinctly', async () => {
  const cases = [
    { status: 422, action: a => a.login(credentials), code: 'invalid_credentials' },
    { status: 400, action: a => a.refresh({ refresh_token: 'stale-fixture-refresh' }), code: 'invalid_refresh_token' },
    { status: 401, action: a => a.user('expired.fixture.jwt'), code: 'authentication_required' },
    { status: 429, action: a => a.login(credentials), code: 'auth_rate_limited' },
    { status: 500, action: a => a.recover({ email: credentials.email }), code: 'auth_provider_unavailable' },
    { status: 503, action: a => a.login(credentials), code: 'auth_provider_unavailable' }
  ];
  for (const item of cases) {
    const calls = [];
    const auth = new SupabaseAuth(config, async (url, options) => {
      calls.push({ url, options });
      return {
        ok: false,
        status: item.status,
        json: async () => ({ message: 'Provider details must remain private' })
      };
    });
    await assert.rejects(item.action(auth), error => {
      assert.equal(error.message, item.code);
      assert.doesNotMatch(error.message, /Provider details/);
      return true;
    }, 'upstream HTTP ' + item.status);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.apikey, config.publishableKey);
    assert.ok(calls[0].url.startsWith(config.url + '/auth/v1/'));
  }
});

test('network failures do not turn into invalid-password responses or leak transport errors', async () => {
  const auth = new SupabaseAuth(config, async () => {
    throw new Error('private-provider-transport-details');
  });
  await assert.rejects(auth.login(credentials), error => {
    assert.equal(error.message, 'auth_provider_unavailable');
    return true;
  });
});
