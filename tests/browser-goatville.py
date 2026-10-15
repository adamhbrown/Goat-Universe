"""Optional real-browser acceptance: Python Playwright + installed Chromium.
Serve the checkout, then run this script. No real league or production writes.
"""
import argparse,json,functools,http.server,shutil,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--base-url',default=None);parser.add_argument('--output-dir',default='/tmp/goatville-qa');parser.add_argument('--chromium',default='/usr/bin/chromium');args=parser.parse_args()
server=None;public_export=None
if args.base_url:
 base=args.base_url.rstrip('/')
else:
 public_export=tempfile.TemporaryDirectory(prefix='goatville-public-')
 checkout=Path(__file__).resolve().parent.parent
 for name in ('index.html','play.html'):shutil.copy2(checkout/name,Path(public_export.name)/name)
 shutil.copytree(checkout/'assets',Path(public_export.name)/'assets')
 class QuietHandler(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=public_export.name))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base='http://127.0.0.1:'+str(server.server_port)
out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
report={'layouts':[],'checks':[],'page_errors':[],'screenshots':[]}
def check(name):report['checks'].append(name)
def ready(page,path='index.html'):
 response=page.goto(base+'/'+path,wait_until='networkidle');assert response.status==200;page.evaluate('document.fonts.ready')
def screenshot(page,name):
 path=out/(name+'.png');page.screenshot(path=str(path));report['screenshots'].append(str(path))
def audit(page,name):
 data=page.evaluate('''() => ({overflow:document.documentElement.scrollWidth>innerWidth+1,fonts:[document.fonts.check('700 20px Manrope'),document.fonts.check('400 16px Inter')],broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),clipped:[...document.querySelectorAll('h1,h2,h3,h4,.team-option,.roster-player,.primary-button,.prototype-link')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent.trim().slice(0,60))})''')
 data['name']=name;report['layouts'].append(data);assert not data['overflow'],name;assert not data['broken'],str(data);assert not data['clipped'],str(data);assert all(data['fonts']),name
keys=['gridiron','hoops','crossover','greatness','classic']
def bracket(page,key,series=False):
 for r,winners in enumerate([['gold','summit','desert','iron'],['gold','iron'],['gold']]):
  for m,team in enumerate(winners):
   page.locator(f'[data-action=bracket-pick][data-bracket={key}][data-round="{r}"][data-match="{m}"][data-team={team}]').click()
   if series:page.locator(f'[data-action=bracket-length][data-round="{r}"][data-match="{m}"]').select_option(str([4,6,7][r]))
def football_picks(page):
 for i,team in enumerate(['harbor','summit','coast','metro']):page.locator(f'[data-action=football-pick][data-index="{i}"][data-team={team}]').click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
 try:
  for w,h in [(320,568),(375,667),(390,844),(430,932),(667,375),(844,390),(932,430),(768,1024),(900,900),(1024,768),(1200,900),(1440,1000)]:
   page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce');page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
   ready(page);audit(page,f'home-{w}x{h}')
   if w in (390,1440):screenshot(page,f'home-{w}')
   for key in keys:
    page.locator(f'.games-card-link[href="#game-details-{key}"]').click();expect(page.locator('#game-details-'+key)).to_have_attribute('open','')
   page.locator('#goatMode').click();expect(page.locator('#goatMode')).to_have_attribute('aria-pressed','true');page.locator('#goatMode').click();expect(page.locator('#goatMode')).to_have_attribute('aria-pressed','false')
   ready(page,'play.html')
   for key in keys:
    page.locator('#tab-'+key).click();audit(page,f'{key}-{w}x{h}')
    if w in (390,1440) and key in ('gridiron','hoops','greatness','classic'):page.evaluate('scrollTo(0,0)');screenshot(page,f'{key}-{w}')
   page.close()
  check('72 layout checks across 12 portrait, landscape, tablet and desktop sizes; original disclosures and GOAT Mode at every size')
  for w,h,touch in [(390,844,True),(1440,1000,False)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,reduced_motion='reduce');page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)));ready(page,'play.html')
   page.locator('[data-action=resolve]').click();expect(page.locator('#room-validation')).to_contain_text('all four');football_picks(page)
   page.locator('[data-action=rank][data-index="0"]').select_option('4');expect(page.locator('[data-action=rank][data-index="3"]')).to_have_value('1')
   page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('10 / 10');check(f'{w}: football picks, confidence swaps, validation, deterministic result')
   page.locator('#football-bracket-room summary').click();page.locator('[data-bracket=football][data-round="0"][data-match="0"][data-team=gold]').click();expect(page.locator('#football-bracket-room')).to_have_attribute('open','');check(f'{w}: football bracket stays open during selection')
   page.locator('#tab-hoops').click();page.locator('[data-action=resolve]').click();expect(page.locator('#room-validation')).to_contain_text('seven');bracket(page,'hoops');page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('Gold City Royals')
   page.locator('[data-bracket=hoops][data-round="0"][data-match="0"][data-team=harbor]').click();expect(page.locator('#room-result')).to_have_count(0);expect(page.locator('[data-bracket=hoops][data-round="2"]').first).to_be_disabled();expect(page.locator('[data-bracket=hoops][data-round="1"][data-match="1"][data-team=iron]')).to_have_attribute('aria-pressed','true');check(f'{w}: basketball completion and dependent pick invalidation')
   page.locator('#tab-crossover').click();page.locator('[data-action=resolve]').click();expect(page.locator('#room-validation')).to_contain_text('all four')
   for i,team in enumerate(['gold','summit','desert','iron']):
    page.locator(f'[data-action=series-pick][data-index="{i}"][data-team={team}]').click();page.locator(f'[data-action=series-length][data-index="{i}"]').select_option(str([5,6,7,4][i]))
   page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('22 games');expect(page.locator('.combined-card>div')).to_have_count(4);check(f'{w}: dual-sport combined prediction')
   page.locator('#tab-greatness').click();page.locator('[data-action=resolve]').click();expect(page.locator('#room-validation')).to_contain_text('five')
   for player in ['qb1','rb2','wr1','te1','fx2']:page.locator(f'[data-player={player}]').click()
   page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('96 – 82');expect(page.locator('#room-result')).to_contain_text('Clubhouse win');page.locator('#league-integration-path summary').click();expect(page.locator('#league-integration-path')).to_contain_text('read-only roster import');check(f'{w}: fantasy lineup, matchup result and integration path')
   page.locator('#tab-classic').click();page.locator('[data-action=resolve]').click();expect(page.locator('#room-validation')).to_contain_text('seven');bracket(page,'classic',True);page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('35 projected games');check(f'{w}: baseball picks, series lengths and champion reveal')
   expect(page.locator('#passport-count')).to_have_text('5 / 5');page.locator('#passport-toggle').click();expect(page.locator('#passport-remember')).not_to_be_checked();page.locator('#passport-remember').check();page.locator('#franchise-name').select_option('Night Shift');page.locator('.gpi-lab summary').click()
   for key in ['form','moment','resolve']:page.locator('#gpi-'+key).fill('100')
   expect(page.locator('#gpi-value')).to_have_text('100');page.reload(wait_until='networkidle');expect(page.locator('#passport-count')).to_have_text('0 / 5');page.locator('#passport-toggle').click();expect(page.locator('#passport-remember')).not_to_be_checked();page.locator('#passport-remember').check();expect(page.locator('#passport-count')).to_have_text('5 / 5');expect(page.locator('#franchise-name')).to_have_value('Night Shift');page.locator('#passport-clear').click();expect(page.locator('#passport-count')).to_have_text('0 / 5');page.reload(wait_until='networkidle');expect(page.locator('#passport-count')).to_have_text('0 / 5');check(f'{w}: passport opt-in, memory-only reload, explicit restoration, identity, GPI and clearing')
   page.locator('#tab-gridiron').focus();page.keyboard.press('ArrowRight');expect(page.locator('#tab-hoops')).to_have_attribute('aria-selected','true');page.keyboard.press('End');expect(page.locator('#tab-classic')).to_have_attribute('aria-selected','true');page.go_back();expect(page.locator('#tab-hoops')).to_have_attribute('aria-selected','true');check(f'{w}: keyboard tabs and browser history')
   ready(page);page.locator('#tee-start').click()
   for index,shots in enumerate([[(-15,68)],[(-31,56),(-6,43)],[(-40,60),(90,50),(-51,55)]]):
    for angle,power in shots:page.locator('#tee-aim').fill(str(angle));page.locator('#tee-power').fill(str(power));page.locator('#tee-putt').click()
    expect(page.locator('#tee-game')).to_have_attribute('data-phase','sunk')
    if index<2:page.locator('#tee-next').click()
   expect(page.locator('#tee-status')).to_contain_text('All 3 cups sunk in 6 putts')
   if w==390:page.locator('#tee-game').scroll_into_view_if_needed();screenshot(page,'goat-tee-result-390')
   page.locator('#tee-next').click();expect(page.locator('#tee-total')).to_have_text('0');expect(page.locator('#tee-game')).to_have_attribute('data-phase','ready');check(f'{w}: full GOAT TEE round, scorecard and replay')
   page.locator('[data-open-cinema]').click();expect(page.locator('#arrival-cinema')).to_be_visible();expect(page.locator('[data-cinema-status]')).to_contain_text('Reduced motion');expect(page.locator('[data-cinema-sound]')).to_have_attribute('aria-pressed','false');page.locator('[data-cinema-sound]').click();expect(page.locator('[data-cinema-sound]')).to_have_attribute('aria-pressed','true');page.locator('[data-cinema-skip]').click();expect(page.locator('#arrival-cinema')).not_to_be_visible();expect(page.locator('#universe')).to_be_focused();check(f'{w}: reduced-motion arrival, sound opt-in and instant skip');context.close()
  page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='no-preference');page.on('pageerror',lambda e:report['page_errors'].append(str(e)));ready(page);assert page.locator('#goat-theme-audio').get_attribute('src') is None;page.locator('#theme-play').click();page.wait_for_function("!document.getElementById('goat-theme-audio').paused && document.getElementById('goat-theme-audio').currentTime > 0");page.locator('#theme-play').click();expect(page.locator('#theme-play')).to_have_attribute('aria-pressed','false');check('official theme loads only after play and supports pause');page.locator('#tee-start').click();page.locator('#tee-aim').fill('-15');page.locator('#tee-power').fill('68');page.locator('#tee-putt').click();expect(page.locator('#tee-putt')).to_be_disabled();expect(page.locator('#tee-game')).to_have_attribute('data-phase','sunk',timeout=8000);check('normal-motion ball animation and locked input')
  page.locator('[data-open-cinema]').click();expect(page.locator('[data-cinema-line]')).to_contain_text('GREATNESS',timeout=6000);page.keyboard.press('Escape');expect(page.locator('#arrival-cinema')).not_to_be_visible();expect(page.locator('[data-open-cinema]')).to_be_focused();check('normal-motion cinema progression and Escape focus return')
  page.locator('[data-open-cinema]').click();page.evaluate("document.querySelector('[data-cinematic]').goatCinema.source='missing-arrival-test.webm';document.querySelector('[data-cinematic]').goatCinema.start()")
  expect(page.locator('[data-cinema-status]')).to_contain_text('video is unavailable',timeout=5000);expect(page.locator('[data-cinema-video]')).to_be_hidden();page.locator('[data-cinema-close]').click();check('missing optional video falls back to original visual study');page.close()
  context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})");page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)));ready(page,'play.html');page.locator('#passport-toggle').click();expect(page.locator('#passport-storage')).to_contain_text('Memory only');page.locator('#passport-remember').check();expect(page.locator('#passport-storage')).to_contain_text('page visit only');football_picks(page);page.locator('[data-action=resolve]').click();expect(page.locator('#passport-count')).to_have_text('1 / 5');check('blocked storage uses a working in-memory passport');context.close()
  context=browser.new_context(java_script_enabled=False,reduced_motion='reduce',viewport={'width':390,'height':844});page=context.new_page();ready(page);page.locator('.games-card-link[href="#game-details-gridiron"]').click();
  if page.locator('#game-details-gridiron').get_attribute('open') is None:
   page.locator('#game-details-gridiron summary').focus();page.keyboard.press('Space')
  expect(page.locator('#game-details-gridiron')).to_have_attribute('open','');expect(page.locator('.destination-list a')).to_have_count(6);expect(page.locator('#tee-fallback')).to_be_visible();expect(page.locator('#tee-fallback')).to_contain_text('JavaScript');check('no-JavaScript navigation and native disclosures');context.close()
  assert not report['page_errors'],report['page_errors'];report['result']='passed'
 except Exception as error:
  report['result']='failed';report['failure']=str(error);raise
 finally:
  (out/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'result':report.get('result'),'layouts':len(report['layouts']),'interaction_groups':len(report['checks']),'errors':report['page_errors'],'report':str(out/'browser-report.json')}));browser.close()
  if server:server.shutdown();server.server_close()
  if public_export:public_export.cleanup()
