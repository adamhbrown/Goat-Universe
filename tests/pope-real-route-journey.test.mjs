import test from 'node:test';
import assert from 'node:assert/strict';
import {application} from '../backend/server.mjs';

const fiveGames = ['first-and-baa', 'horns-and-hoops', 'goat-crossover', 'league-of-greatness', 'goat-classic'];
const founderPages = ['/arrival-experience.html', '/goatville-city.html', '/goatville-stadium.html', '/goatville-cinema.html', '/commerce.html', '/gpi.html'];

// Real local development HTTP, not a static-file mock, payment environment, or hosted deployment.
test('Pope: founder City -> five Games -> Media -> Market links resolve on the integrated HTTP site', async t => {
  const app = await application({
    mode:'local', appEnv:'development', localPath:undefined,
    appOrigin:'http://fixture.invalid', paymentsEnabled:false,
    authEmailEnabled:false, publicSiteEnabled:true, tiers:{}
  });
  await new Promise((resolve,reject)=>{
    app.server.once('error',reject);
    app.server.listen(0,'127.0.0.1',resolve);
  });
  t.after(async()=>{app.server.closeAllConnections();await app.close();});
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const view = async route => {
    const res = await fetch(origin + route);
    assert.equal(res.status,200,'Broken founder journey HTTP route: ' + route);
    assert.ok((res.headers.get('content-type')||'').includes('text/html'));
    assert.ok((res.headers.get('content-security-policy')||'').includes("script-src 'self'"));
    return res.text();
  };
  const home = await view('/');
  assert.match(home,/GOATVILLE/);
  assert.ok(home.includes('href="./commerce.html#collections"'));
  for(const route of founderPages) await view(route);
  const city = await view('/goatville-city.html');
  assert.ok(city.includes('href="commerce.html#collections"'));
  assert.ok(city.includes('href="goatville-stadium.html"'));
  const stadium = await view('/goatville-stadium.html');
  assert.ok(stadium.includes('<nav class="mobile-nav"') && stadium.includes('href="/manage">My League</a>'));
  assert.ok(stadium.includes('href="/games">ENTER THE FIVE GOAT GAMES'));
  for(const slug of fiveGames){
    assert.ok(stadium.includes('href="/games/'+slug+'"'),'Missing Stadium competition: '+slug);
    await view('/games/'+slug);
  }
  const media = await view('/goatville-cinema.html');
  assert.match(media,/GOATVERSE CREATIVE MEDIA/);
  assert.ok(media.includes('href="arrival-experience.html#media"'));
  assert.ok(media.includes('href="/games/league-of-greatness"'));
  await view('/manage');
  const collections = await view('/commerce.html');
  assert.match(collections,/id="gst-time"/);
  assert.match(collections,/id="ny-time"/);
  assert.match(collections,/No logo, slogan, artwork or design/);
  const health = await(await fetch(origin+'/health')).json();
  assert.equal(health.payments_enabled,false);
  assert.equal(health.auth_email_enabled,false);
});
