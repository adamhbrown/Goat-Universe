import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { application } from '../server.mjs';
import { configuration } from '../config.mjs';
import { mountBullpen, CEO_PROMPT } from '../bullpen/ui.mjs';
import { BullpenClient } from '../bullpen/client.mjs';

test('actual Bullpen forms post once, escape text, create assignments, and clear private views on sign-out',async () => {
  const app = await application({...configuration({}),localPath:undefined});
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const dom = new JSDOM(await readFile(new URL('../bullpen/index.html',import.meta.url),'utf8'),{url:base+'/bullpen'});
  const $ = id => dom.window.document.getElementById(id);
  let screen;
  const submit = form => form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  async function until(check) {
    const end = Date.now()+5000;
    while (!check()) { if (Date.now()>end) throw new Error('Bullpen DOM timeout: '+$('notice').textContent); await new Promise(r => setTimeout(r,10)); }
  }
  try {
    const {user} = await app.auth.signup({email:'bullpen-dom@fixture.invalid',password:'TEST-DOM-Password-1234'});
    await app.db.db.query("update bullpen_private.seats set user_id=$1,enabled=true where id='adam'",[user.id]);
    screen = mountBullpen(dom.window.document,{fetchImpl:(path,options) => {
      assert.ok(path.startsWith('/'),'UI only contacts its own backend'); return fetch(base+path,options);
    },schedule:() => 0,cancel:() => {}});
    $('login').elements.email.value = 'bullpen-dom@fixture.invalid'; $('login').elements.password.value = 'TEST-DOM-Password-1234';
    submit($('login')); await until(() => !$('workspace').hidden);
    assert.equal($('login').elements.password.value,'');
    assert.match($('sync').textContent,/Local prototype/);
    assert.match($('seats').textContent,/Not connected/);
    assert.equal(dom.window.localStorage.length,0); assert.equal(dom.window.sessionStorage.length,0);
    $('acceptance-prompt').click(); assert.equal($('compose').elements.content.value,CEO_PROMPT);
    submit($('compose')); submit($('compose'));
    await until(() => $('messages').textContent.includes(CEO_PROMPT) && $('notice').textContent.includes('Message recorded'));
    assert.equal((await app.db.db.query('select count(*) n from bullpen_private.messages')).rows[0].n,1);
    const malicious = '<img src=x onerror=alert(1)> TEST';
    $('compose').elements.content.value = malicious; submit($('compose'));
    await until(() => $('messages').textContent.includes(malicious));
    assert.equal($('messages').querySelector('img'),null);
    $('new-task').click(); const editor = $('task-editor').querySelector('form');
    editor.elements.title.value = 'TEST DOM assignment'; editor.elements.work_key.value = 'test/dom-assignment'; editor.elements.owner.value = 'codex';
    submit(editor); await until(() => $('task-list').textContent.includes('TEST DOM assignment'));
    assert.match($('dashboard').textContent,/TEST DOM assignment/);
    const inspect = [...$('messages').querySelectorAll('button')].find(b => b.textContent === 'Check acceptance evidence');
    inspect.click(); await until(() => !$('acceptance').hidden);
    assert.match($('acceptance').textContent,/Cross-agent acceptance is incomplete/);
    assert.doesNotMatch($('acceptance').textContent,/Transport exchange recorded/);
    $('logout').click();
    assert.equal($('workspace').hidden,true);
    for (const id of ['messages','dashboard','task-list','intel-list','seats']) assert.equal($(id).childElementCount,0);
    assert.equal($('compose').elements.content.value,'');
  } finally { screen?.destroy(); dom.window.close(); await app.close(); }
});

test('permissioned adapter enforces HTTPS and uses authenticated API posts without generating replies',async () => {
  assert.throws(() => new BullpenClient({origin:'http://remote.invalid',accessToken:'TEST'}),/https_origin_required/);
  assert.throws(() => new BullpenClient({origin:'https://user:pass@host.invalid',accessToken:'TEST'}),/https_origin_required/);
  const calls = [];
  const client = new BullpenClient({origin:'https://bullpen.fixture.invalid',accessToken:'TEST',fetchImpl:async (url,options) => {
    calls.push({url,options}); return {ok:true,json:async () => ({messages:[],tasks:[],intelligence:[]})};
  }});
  await client.context(42); assert.equal(calls.length,1); assert.equal(JSON.parse(calls[0].options.body).op,'poll');
  assert.equal(calls[0].options.headers.Authorization,'Bearer TEST'); assert.equal(calls[0].options.redirect,'error');
  await client.reply({messageId:43,content:'TEST supplied by the external workstream'});
  const body = JSON.parse(calls[1].options.body); assert.equal(body.source,'api'); assert.equal(body.reply_to,43);
  assert.equal(body.content,'TEST supplied by the external workstream'); assert.ok(body.client_id);
});
