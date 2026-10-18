import test from 'node:test';
import assert from 'node:assert/strict';
import { application } from '../server.mjs';
import { configuration } from '../config.mjs';

// Local-only acceptance journey. These identities and leagues exist solely
// in the in-memory PostgreSQL-WASM test database; never in hosted Supabase.
test('member journey: signup, five GOAT Games, actor isolation, token rotation and logout', async t => {
  const app = await application({ ...configuration({}), localPath: undefined });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    app.server.closeAllConnections();
    await app.close();
  });
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const post = async (path, body = {}, token, headers = {}) => {
    const response = await fetch(origin + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers
      },
      body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  };

  const one = { email: 'member-one@journey.fixture.invalid', password: 'JOURNEY-Fixture-Password-12345', display_name: 'Member One' };
  const two = { email: 'member-two@journey.fixture.invalid', password: 'JOURNEY-Fixture-Password-12345', display_name: 'Member Two' };
  const firstSignup = await post('/auth/signup', one);
  const secondSignup = await post('/auth/signup', two);
  assert.equal(firstSignup.status, 201);
  assert.equal(secondSignup.status, 201);
  const idOne = firstSignup.data.user.id;
  const idTwo = secondSignup.data.user.id;
  assert.notEqual(idOne, idTwo);
  const firstLogin = await post('/auth/login', one);
  const secondLogin = await post('/auth/login', two);
  assert.equal(firstLogin.status, 200);
  assert.equal(secondLogin.status, 200);
  const accessOne = firstLogin.data.access_token;
  const accessTwo = secondLogin.data.access_token;

  assert.equal((await post('/query', { op: 'me' })).status, 401);
  assert.equal((await post('/query', { op: 'me' }, accessOne, {
    Origin: 'https://untrusted.fixture.invalid'
  })).status, 403);
  assert.deepEqual((await post('/query', { op: 'me' }, accessOne)).data.roles, []);
  assert.deepEqual((await post('/query', { op: 'me' }, accessTwo)).data.roles, []);

  const catalogResponse = await fetch(origin + '/goat-games');
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.deepEqual(new Set(catalog.games.map(g => g.id)), new Set([
    'first-and-baa', 'horns-and-hoops', 'goat-crossover',
    'league-of-greatness', 'goat-classic'
  ]));

  const owned = [];
  for (const game of catalog.games) {
    const result = await post('/commands', {
      op: 'game_draft_create',
      game_key: game.id,
      name: game.name + ' MEMBER JOURNEY FIXTURE',
      season: '2027'
    }, accessOne);
    assert.equal(result.status, 200, game.id + ': ' + JSON.stringify(result.data));
    assert.ok(result.data.id);
    owned.push(result.data.id);
  }
  const myGames = await post('/query', { op: 'competition_dashboard' }, accessOne);
  const theirGames = await post('/query', { op: 'competition_dashboard' }, accessTwo);
  assert.equal(myGames.status, 200);
  assert.equal(theirGames.status, 200);
  assert.equal(myGames.data.competitions.length, 5);
  assert.equal(theirGames.data.competitions.length, 5);
  assert.equal(myGames.data.competitions.reduce((n, c) => n + c.leagues.length, 0), 5);
  assert.equal(theirGames.data.competitions.reduce((n, c) => n + c.leagues.length, 0), 0);
  assert.equal((await post('/query', { op: 'league', league_id: owned[0] }, accessTwo)).status, 403);
  assert.equal((await post('/bullpen/query', { op: 'snapshot' }, accessOne)).status, 403);

  // A caller-supplied user_id cannot redirect profile updates to another member.
  const attemptedSpoof = await post('/commands', {
    op: 'profile_update', display_name: 'Member Two Updated', user_id: idOne,
    role: 'executive'
  }, accessTwo);
  assert.equal(attemptedSpoof.status, 200);
  const firstMe = await post('/query', { op: 'me' }, accessOne);
  const secondMe = await post('/query', { op: 'me' }, accessTwo);
  assert.equal(firstMe.data.profile.user_id, idOne);
  assert.equal(secondMe.data.profile.user_id, idTwo);
  assert.equal(firstMe.data.profile.display_name, 'Member One');
  assert.equal(secondMe.data.profile.display_name, 'Member Two Updated');
  assert.deepEqual(secondMe.data.roles, []);

  // Client session reauthentication must work without reviving old credentials.
  assert.equal((await post('/auth/login', {
    email: one.email, password: 'wrong-fixture-password-123'
  })).status, 401);
  assert.equal((await post('/auth/refresh', {
    refresh_token: 'invalid-refresh-fixture'
  })).status, 401);
  const rotated = await post('/auth/refresh', { refresh_token: firstLogin.data.refresh_token });
  assert.equal(rotated.status, 200);
  assert.ok(rotated.data.access_token);
  assert.notEqual(rotated.data.access_token, accessOne);
  assert.equal((await post('/query', { op: 'me' }, accessOne)).status, 401);
  assert.equal((await post('/query', { op: 'me' }, rotated.data.access_token)).status, 200);
  assert.equal((await post('/auth/refresh', { refresh_token: firstLogin.data.refresh_token })).status, 401);

  // Sign-out revokes the current session, but never another person's session.
  const logout = await post('/auth/logout', {}, rotated.data.access_token);
  assert.equal(logout.status, 200);
  assert.equal(logout.data.logged_out, true);
  assert.equal((await post('/query', { op: 'me' }, rotated.data.access_token)).status, 401);
  assert.equal((await post('/auth/refresh', { refresh_token: rotated.data.refresh_token })).status, 401);
  assert.equal((await post('/query', { op: 'me' }, accessTwo)).status, 200);
});
