// Optional real-browser acceptance. Does not install dependencies, access a
// provider, or serve repository files beyond the explicit guest bundle.
import assert from 'node:assert/strict';
import {createGuestTestServer} from '../guest-test-server.mjs';
let browser, server, browserReady = false;
try {
  const {chromium}=await import(process.env.GOAT_PLAYWRIGHT_MODULE || 'playwright');
  browser=await chromium.launch({headless:true});
  browserReady=true;
  const prefix='/Goat-Universe/backend/goatville/';
  const fixture=createGuestTestServer({prefix});
  server=fixture.server;
  const requests=fixture.requests;
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  const results=[];
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    try {
      const page=await context.newPage(), errors=[];
      page.on('pageerror',error => errors.push(error.message));
      await page.goto(base+'demo.html');
      await page.getByRole('button',{name:'Start test challenge',exact:true}).click();
      const challenge=page.frameLocator('iframe');
      const button=challenge.getByRole('button',{name:'Complete test challenge',exact:true});
      await button.waitFor();
      await button.click({trial:true});
      await button.focus(); await page.keyboard.press('Enter');
      await page.getByRole('status').filter({hasText:'kept in memory'}).waitFor();
      assert.equal(await page.locator('#stamps li').count(),1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
      const frame=page.frames().find(f=>f.url().endsWith('/challenge.html'));
      assert.deepEqual(await frame.evaluate(async () => {
        let parentDenied=false,storageDenied=false,networkDenied=false;
        try { void parent.document.body; } catch { parentDenied=true; }
        try { void localStorage.length; } catch { storageDenied=true; }
        try { await fetch('/must-not-fetch'); } catch { networkDenied=true; }
        return {parentDenied,storageDenied,networkDenied};
      }),{parentDenied:true,storageDenied:true,networkDenied:true});
      assert.ok(!requests.includes('/must-not-fetch'));
      await page.getByRole('button',{name:'Stop challenge',exact:true}).click();
      assert.equal(await page.locator('iframe').count(),0);
      await page.reload(); assert.equal(await page.locator('#stamps li').count(),0);
      await page.getByRole('checkbox').check();
      await page.getByRole('button',{name:'Start test challenge',exact:true}).click();
      await page.frameLocator('iframe').getByRole('button',{name:'Complete test challenge',exact:true}).click();
      await page.getByRole('status').filter({hasText:'saved on this device'}).waitFor();
      await page.reload(); assert.equal(await page.locator('#stamps li').count(),0);
      await page.getByRole('checkbox').check(); assert.equal(await page.locator('#stamps li').count(),1);
      await page.getByRole('button',{name:'Clear guest stamps',exact:true}).click();
      assert.equal(await page.locator('#stamps li').count(),0);
      assert.deepEqual(errors,[]);
      results.push({width,prefix,reduced_motion:true,status:'passed'});
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({status:'passed',checks:results},null,2));
} catch {
  console.log(JSON.stringify({status:browserReady?'failed':'blocked',diagnosis:browserReady?'guest_browser_acceptance_failed':'playwright_and_chromium_required'}));
  process.exitCode=browserReady?1:2;
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
