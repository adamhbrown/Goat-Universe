"""Real Chromium acceptance for the resort, shared guest passport and keepsakes.
No external host or backend. Requires Python Playwright and installed Chromium.
"""
import argparse,functools,http.server,json,shutil,tempfile,threading,xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',default='/tmp/goatville-resort-qa');parser.add_argument('--chromium',default='/usr/bin/chromium');args=parser.parse_args()
checkout=Path(__file__).resolve().parent.parent
out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
public=tempfile.TemporaryDirectory(prefix='goatville-resort-public-')
for name in ('index.html','play.html','resort.html'):shutil.copy2(checkout/name,Path(public.name)/name)
shutil.copytree(checkout/'assets',Path(public.name)/'assets')
class QuietHandler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=public.name))
threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)
report={'layouts':[],'checks':[],'page_errors':[],'screenshots':[],'downloads':[]}
districts=['town-square','championship-district','tee-district','club-goat','goat-island','mountain-lodge']
def check(name):report['checks'].append(name)
def ready(page,path='resort.html'):
 response=page.goto(base+'/'+path,wait_until='networkidle');assert response.status==200;page.evaluate('document.fonts.ready')
def shot(page,name,full=False):
 path=out/(name+'.png');page.screenshot(path=str(path),full_page=full);report['screenshots'].append(str(path))
def audit(page,name):
 data=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,fonts:[document.fonts.check('700 20px Manrope'),document.fonts.check('400 16px Inter')],broken:[...document.images].filter(e=>!e.complete||!e.naturalWidth).map(e=>e.src),clipped:[...document.querySelectorAll('h1,h2,h3,h4,.primary,.iq-option,.clue-options button,.district-list button,.stamp-list strong')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent.trim().slice(0,60)),small_buttons:[...document.querySelectorAll('#resort-content button,#resort-content a')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<43).map(e=>e.textContent.trim().slice(0,50))})''')
 data['name']=name;report['layouts'].append(data)
 assert not data['overflow'],str(data);assert not data['broken'],str(data);assert not data['clipped'],str(data);assert not data['small_buttons'],str(data);assert all(data['fonts']),str(data)
def select(page,id):page.locator(f'.district-list [data-district={id}]').click()
def clue(page,id,wrong=False):
 answer=page.evaluate('(id)=>GoatResort.districts.find(d=>d.id===id).answer',id)
 if wrong:page.locator(f'[data-action=clue][data-answer="{(answer+1)%3}"]').click();expect(page.locator('#clue-feedback')).to_contain_text('try again')
 page.locator(f'[data-action=clue][data-answer="{answer}"]').click();expect(page.locator('.stamp-complete')).to_contain_text('LOCAL-UNVERIFIED')
def iq_round(page,perfect=False):
 page.locator('[data-action=iq-start]').click();expected=0
 for index in range(6):
  answer=page.evaluate('()=>GoatResort.questions.find(q=>q.prompt===document.getElementById("question-title").textContent).answer')
  if index==1 and not perfect:page.locator('[data-action=iq-pass]').click()
  else:
   chosen=answer if perfect or index%2==0 else (answer+1)%4
   page.locator(f'[data-action=iq-answer][data-answer="{chosen}"]').click();expected+=int(chosen==answer)
  expect(page.locator('[data-action=iq-answer]').first).to_be_disabled();expect(page.locator('#answer-feedback')).to_be_visible();page.locator('[data-action=iq-next]').click()
 expect(page.locator('.iq-result-head>strong')).to_contain_text(str(expected));expect(page.locator('.answer-review li')).to_have_count(6)
 return expected
def football(page):
 for i,team in enumerate(['harbor','summit','coast','metro']):page.locator(f'[data-action=football-pick][data-index="{i}"][data-team={team}]').click()
 page.locator('[data-action=resolve]').click();expect(page.locator('#room-result')).to_contain_text('10 / 10')
def bracket(page,key,series=False):
 for r,winners in enumerate([['gold','summit','desert','iron'],['gold','iron'],['gold']]):
  for m,team in enumerate(winners):
   page.locator(f'[data-action=bracket-pick][data-bracket={key}][data-round="{r}"][data-match="{m}"][data-team={team}]').click()
   if series:page.locator(f'[data-action=bracket-length][data-round="{r}"][data-match="{m}"]').select_option(str([4,6,7][r]))
def download_card(page,key):
 with page.expect_download() as event:page.locator('[data-action=download-card]').click()
 download=event.value;path=out/(key+'-practice.svg');download.save_as(path)
 svg=path.read_text();tree=ET.fromstring(svg);assert tree.tag=='{http://www.w3.org/2000/svg}svg';assert 'FICTIONAL PRACTICE EDITION' in svg and 'LOCAL-UNVERIFIED KEEPSAKE' in svg;assert len(svg)<20000
 report['downloads'].append({'room':key,'filename':download.suggested_filename,'bytes':len(path.read_bytes())})
 page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Denied for acceptance'))}})")
 page.locator('[data-action=copy-card]').click();expect(page.locator('#keepsake-text')).to_be_visible()
 assert 'Local-unverified keepsake' in page.locator('#keepsake-text').input_value()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
 try:
  for w,h in [(320,568),(375,667),(390,844),(430,932),(667,375),(844,390),(932,430),(768,1024),(900,900),(1024,768),(1200,900),(1440,1000)]:
   page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce');page.on('pageerror',lambda error:report['page_errors'].append(str(error)));ready(page)
   for id in districts:
    select(page,id);audit(page,f'{id}-{w}x{h}')
   page.locator('[data-route=sports-iq]').click();audit(page,f'iq-intro-{w}x{h}');page.locator('[data-action=iq-start]').click();audit(page,f'iq-question-{w}x{h}')
   page.locator('[data-action=iq-answer]').first.click();audit(page,f'iq-feedback-{w}x{h}')
   page.locator('[data-route=passport]').click();audit(page,f'passport-{w}x{h}')
   if w in (390,1440):
    page.locator('[data-route=explore]').click();select(page,'town-square');page.evaluate('scrollTo(0,0)');shot(page,f'resort-{w}',True)
    page.locator('[data-route=sports-iq]').click();page.evaluate('scrollTo(0,0)');shot(page,f'sports-iq-{w}')
   page.close()
  check('120 layout checks: six districts, IQ intro/question/feedback and passport at 12 phone/landscape/tablet/desktop sizes')
  for w,h,touch in [(390,844,True),(1440,1000,False)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,reduced_motion='reduce')
   context.add_init_script("window.storageReads=0;const original=Object.getOwnPropertyDescriptor(window,'localStorage');Object.defineProperty(window,'localStorage',{get(){window.storageReads++;return original.get.call(window)}})")
   page=context.new_page();page.on('pageerror',lambda error:report['page_errors'].append(str(error)));ready(page)
   for id in districts:select(page,id);clue(page,id,wrong=id=='town-square')
   expect(page.locator('.circuit-number')).to_contain_text('6');expect(page.locator('#resort-count')).to_have_text('6');check(f'{w}: six discovery clues, wrong-answer retry, honest completion and local stamps')
   page.locator('[data-route=sports-iq]').click();assert iq_round(page)==3;expect(page.locator('#resort-count')).to_have_text('7');page.evaluate('scrollTo(0,0)');shot(page,f'sports-iq-result-{w}',True)
   page.locator('[data-action=iq-start]').click();expect(page.locator('.iq-scoreline')).to_contain_text('0 CORRECT');check(f'{w}: six-sport play, pass, locked answers, full answer review and replay')
   assert page.evaluate('storageReads')==0;page.locator('[data-route=passport]').click();page.locator('#resort-remember').check();expect(page.locator('#resort-storage')).to_contain_text('Saving souvenirs');page.locator('#resort-franchise').select_option('Night Shift');assert page.evaluate('storageReads')==1
   ready(page,'play.html');expect(page.locator('#passport-count')).to_have_text('0 / 5');assert page.evaluate('storageReads')==0;page.locator('#passport-toggle').click();page.locator('#passport-remember').check();expect(page.locator('#franchise-name')).to_have_value('Night Shift');assert page.evaluate('goatGuestJournal.count()')==7;football(page)
   ready(page,'resort.html#passport');expect(page.locator('#resort-count')).to_have_text('0');expect(page.locator('#resort-remember')).not_to_be_checked();page.locator('#resort-remember').check();expect(page.locator('#resort-count')).to_have_text('8');expect(page.locator('#resort-franchise')).to_have_value('Night Shift');check(f'{w}: shared sports/discovery journal restores only after explicit opt-in on each page')
   page.locator('[data-action=clear-passport]').click();expect(page.locator('#resort-count')).to_have_text('0');expect(page.locator('#resort-remember')).not_to_be_checked();page.reload(wait_until='networkidle');page.locator('#resort-remember').check();expect(page.locator('#resort-count')).to_have_text('0');check(f'{w}: clear removes the saved cross-page journal and turns saving off')
   page.locator('[data-route=explore]').click();select(page,'club-goat');assert page.locator('#goat-theme-audio').get_attribute('src') is None;page.locator('[data-action=open-player]').click();expect(page.locator('#theme-play')).to_be_focused();assert page.locator('#goat-theme-audio').get_attribute('src') is None;page.locator('#theme-play').click();page.wait_for_function("()=>!document.getElementById('goat-theme-audio').paused&&document.getElementById('goat-theme-audio').currentTime>0");page.locator('[data-action=close-player]').click();expect(page.locator('#theme-lounge')).not_to_be_visible();assert page.locator('#goat-theme-audio').evaluate('(audio)=>audio.paused');expect(page.locator('[data-action=open-player]')).to_be_focused();check(f'{w}: Club GOAT opens silently, plays on demand, closes with pause/focus return')
   select(page,'goat-island');page.go_back();expect(page.locator('#district-title')).to_have_text('CLUB GOAT');select(page,'mountain-lodge');expect(page.locator('.dossier-copy')).to_contain_text('no skiing attraction yet');page.locator('[data-route=sports-iq]').focus();page.keyboard.press('Enter');expect(page.locator('[data-route=sports-iq]')).to_have_attribute('aria-current','page');check(f'{w}: deep links, browser history, keyboard route navigation and world-preview labels')
   context.close()
  page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.on('pageerror',lambda error:report['page_errors'].append(str(error)));ready(page,'play.html');football(page);download_card(page,'gridiron')
  page.locator('[data-action=next-room]').click();expect(page.locator('#experience h1')).to_have_text('Horns & Hoops');bracket(page,'hoops');page.locator('[data-action=bracket-round][data-bracket=hoops][data-round="2"]').click();before=page.locator('[data-bracket-scroll=hoops]').evaluate('(el)=>el.scrollLeft');assert before>100;page.locator('[data-bracket=hoops][data-round="2"][data-team=iron]').click();after=page.locator('[data-bracket-scroll=hoops]').evaluate('(el)=>el.scrollLeft');assert abs(before-after)<2;page.locator('[data-action=resolve]').click();download_card(page,'hoops');check('mobile bracket round jump and selection preserve horizontal position')
  page.locator('[data-action=next-room]').click()
  for i,team in enumerate(['gold','summit','desert','iron']):page.locator(f'[data-action=series-pick][data-index="{i}"][data-team={team}]').click();page.locator(f'[data-action=series-length][data-index="{i}"]').select_option('5')
  page.locator('[data-action=resolve]').click();download_card(page,'crossover');page.locator('[data-action=next-room]').click()
  for player in ['qb1','rb2','wr1','te1','fx2']:page.locator(f'[data-player={player}]').click()
  page.locator('[data-action=resolve]').click();download_card(page,'greatness');page.locator('[data-action=next-room]').click();bracket(page,'classic',True);page.locator('[data-action=resolve]').click();download_card(page,'classic');expect(page.locator('.journey-next')).to_contain_text('You made every call.');page.locator('#room-result').scroll_into_view_if_needed();shot(page,'championship-keepsake-390',True);check('all five rooms download valid labeled SVG cards, clipboard denial has a manual path, next-room journey completes');page.close()
  context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})");page=context.new_page();page.on('pageerror',lambda error:report['page_errors'].append(str(error)));ready(page,'resort.html#passport');page.locator('#resort-remember').check();expect(page.locator('#resort-storage')).to_contain_text('unavailable');page.locator('[data-route=explore]').click();clue(page,'town-square');expect(page.locator('#resort-count')).to_have_text('1');check('blocked storage preserves working discovery play');context.close()
  context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=context.new_page();ready(page);expect(page.locator('#resort-fallback')).to_be_visible();expect(page.locator('#resort-fallback a')).to_have_count(4);page.locator('#resort-fallback a[href="play.html"]').click();expect(page.locator('#arcade-fallback')).to_be_visible();check('no-JavaScript fallback retains ordinary destination navigation');context.close()
  page=browser.new_page(viewport={'width':390,'height':844});page.route('**/resort-engine.js',lambda route:route.abort());ready(page);expect(page.locator('#resort-fallback')).to_be_visible();check('unavailable game model leaves the visible fallback intact');page.close()
  page=browser.new_page();ready(page)
  page.evaluate("()=>{window.cspBlocks=[];document.addEventListener('securitypolicyviolation',e=>cspBlocks.push(e.effectiveDirective));const script=document.createElement('script');script.textContent='window.unreviewedCodeRan=true';document.body.append(script);}")
  page.wait_for_function("()=>cspBlocks.includes('script-src-elem')");assert page.evaluate('()=>window.unreviewedCodeRan') is None
  assert page.evaluate("()=>fetch('https://example.invalid/goatville-csp-test').then(()=>false).catch(()=>true)") is True
  page.wait_for_function("()=>cspBlocks.includes('connect-src')");check('resort meta CSP blocks injected inline scripts and outbound fetch without unsafe-eval');page.close()
  assert not report['page_errors'],report['page_errors'];report['result']='passed'
 except Exception as error:report['result']='failed';report['failure']=str(error);raise
 finally:
  (out/'resort-browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'result':report.get('result'),'layouts':len(report['layouts']),'interaction_groups':len(report['checks']),'errors':report['page_errors'],'report':str(out/'resort-browser-report.json')}));browser.close();server.shutdown();server.server_close();public.cleanup()
