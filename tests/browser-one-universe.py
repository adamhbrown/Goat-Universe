"""Local integration acceptance. Uses temporary test data, Chromium and no providers."""
import argparse,json,os,socket,subprocess,tempfile,time,urllib.request,urllib.error
from pathlib import Path
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--output-dir',default='/tmp/late-night-qa')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
report={'scope':'Local Chromium; no Safari, physical device, hosted Auth/RLS or production acceptance','layouts':[],'checks':[],'page_errors':[],'http_errors':[],'routes':[]}
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if 'id' in d:self.ids.append(d['id'])
  if tag=='a' and 'href' in d:self.links.append(d['href'])
def request(url):
 try:
  with urllib.request.urlopen(url,timeout=5) as r:return r.status,r.read(),dict(r.headers)
 except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)
def await_server(process,base):
 for _ in range(150):
  if process.poll() is not None:raise RuntimeError('local_server_exited')
  try:
   if request(base+'/health')[0]==200:return
  except OSError:pass
  time.sleep(.1)
 raise RuntimeError('local_server_not_ready')
def stop(process):
 process.terminate()
 try:process.wait(timeout=8)
 except subprocess.TimeoutExpired:process.kill();process.wait()

def run(base):
 public=json.loads((root/'backend/public-files.json').read_text())
 parents=[p for p in public if p.endswith('.html') and not p.startswith('guest/')]
 keys=['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic']
 routes=['/']+['/'+p for p in parents]+['/games','/manage','/play','/bullpen']+['/games/'+k for k in keys]
 for route in routes:
  status,body,headers=request(base+route);assert status==200,(route,status)
  report['routes'].append({'path':route,'status':status})
 # Audit actual public HTML navigation, including cross-page fragments.
 for name in parents:
  p=Links();p.feed((root/name).read_text());assert len(p.ids)==len(set(p.ids)),name
  for href in p.links:
   if href.startswith(('https:','http:','mailto:')):continue
   path,_,fragment=href.partition('#');target=name if not path else path.lstrip('/')
   if fragment and (target,fragment) not in {('play.html',k) for k in ['gridiron','hoops','crossover','greatness','classic']} | {('resort.html',k) for k in ['explore','sports-iq','passport']}:
    if target not in public:raise AssertionError((name,href,'missing fragment target'))
    target_parser=Links();target_parser.feed((root/target).read_text())
    assert fragment in target_parser.ids,(name,href,'missing fragment')
   if path:assert request(base+'/'+target)[0]==200,(name,href)
 report['checks'].append('All public parent hrefs and same/cross-page fragments resolve over the local application')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   for width,height in [(320,700),(390,844),(768,1024),(1440,1000)]:
    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce',timezone_id='Asia/Tokyo',has_touch=width==390,is_mobile=width==390)
    page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
    page.on('response',lambda r:report['http_errors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
    for route in ['/','/goatville-city.html','/goatville-stadium.html','/goatville.html','/play.html','/resort.html','/goat-games-play-lab.html','/goatville-cinema.html','/goatville-field-vision.html','/goatville-spotlight.html','/games','/manage','/bullpen']:
     page.goto(base+route,wait_until='networkidle');page.evaluate('document.fonts.ready')
     expect(page.locator('#gv-gst-clock')).to_be_visible()
     # A different browser timezone must not change New York display.
     assert page.locator('#gv-gst-clock time').get_attribute('datetime').endswith('Z')
     assert page.locator('#gv-gst-clock time').inner_text()==page.evaluate("new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(document.querySelector('#gv-gst-clock time').dateTime))+' GST'")
     page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
     page.wait_for_timeout(100)
     layout=page.evaluate('''() => ({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),clock:(()=>{const r=document.querySelector('#gv-gst-clock').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})(),overlap:(()=>{const c=document.querySelector('#gv-gst-clock').getBoundingClientRect(),b=document.querySelector('#gv-portal-launch')?.getBoundingClientRect();return b?c.x<b.right&&c.right>b.x&&c.y<b.bottom&&c.bottom>b.y:false})()})''')
     layout.update({'route':route,'width':width});report['layouts'].append(layout)
     assert not layout['overflow'],(route,width,'overflow')
     assert not layout['broken'],(route,width,layout['broken'])
     assert not layout['overlap'],(route,width,'clock overlaps navigation')
     assert layout['clock']['x']>=0 and layout['clock']['right']<=width,(route,width,'clock clipped')
     if width in (390,1440) and route in ['/','/goatville-city.html','/games','/bullpen']:
      name={'/':'arrival','/goatville-city.html':'city','/games':'leagues','/bullpen':'bullpen'}[route]
      if route=='/goatville-city.html':
       page.locator('.city').screenshot(path=str(out/f'city-skyline-{width}.png'));page.locator('#headquarters').scroll_into_view_if_needed();page.evaluate('scrollBy(0,-90)')
      page.screenshot(path=str(out/f'{name}-{width}.png'))
     if route in ['/','/goatville-city.html']:
      trigger=page.locator('#gv-portal-launch');trigger.focus();page.keyboard.press('Enter')
      expect(page.locator('#gv-portal-dialog')).to_be_visible()
      expect(page.locator('#gv-portal-dialog #gv-gst-clock')).to_be_visible()
      expect(page.get_by_role('button',name='Close universe destinations')).to_be_focused()
      page.keyboard.press('Shift+Tab');assert page.evaluate("document.querySelector('#gv-portal-dialog').contains(document.activeElement)")
      page.keyboard.press('Escape');expect(trigger).to_be_focused()
    context.close()
   # Verify JavaScript hash routes separately from ordinary HTML fragments.
   context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page()
   for key in ['gridiron','hoops','crossover','greatness','classic']:
    page.goto(base+'/play.html#'+key,wait_until='networkidle');expect(page.locator('#tab-'+key)).to_have_attribute('aria-selected','true')
   for key in ['explore','sports-iq','passport']:
    page.goto(base+'/resort.html#'+key,wait_until='networkidle');expect(page.locator('[data-route='+key+']')).to_have_attribute('aria-current','page')
   context.close();report['checks'].append('Five sports-room and three resort hash routes open the requested view')
   # Real click journey into persistent local league drafts. All data is synthetic.
   context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce')
   page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
   page.goto(base,wait_until='networkidle');page.locator('.enter-universe').click();expect(page).to_have_url(base+'/goatville-city.html')
   page.get_by_role('link',name='OPEN LEAGUE WORKSPACE',exact=False).click();expect(page).to_have_url(base+'/games')
   page.get_by_role('link',name='Open 1st & BAA',exact=True).click()
   form=page.locator('#account-form');form.locator('[name=email]').fill('sprint-browser@fixture.invalid');form.locator('[name=password]').fill('LOCAL-SPRINT-REVIEW-123456789');form.locator('[name=display_name]').fill('LOCAL BROWSER QA')
   form.get_by_role('button',name='Create account',exact=True).click();expect(page.locator('#notice')).to_contain_text('account created');form.locator('[name=password]').fill('LOCAL-SPRINT-REVIEW-123456789');form.get_by_role('button',name='Sign in',exact=True).click();expect(page.locator('#member-panel')).to_be_visible()
   page.get_by_label('Competition name',exact=True).fill('LOCAL QA DRAFT · NOT OFFICIAL');page.get_by_label('Season year',exact=True).fill('2027');page.get_by_role('button',name='Create draft',exact=True).click()
   expect(page.locator('#league-list')).to_contain_text('LOCAL QA DRAFT')
   page.screenshot(path=str(out/'local-draft-390.png'))
   page.reload(wait_until='networkidle');expect(page.locator('#account-panel')).to_be_visible()
   form=page.locator('#account-form');form.locator('[name=email]').fill('sprint-browser@fixture.invalid');form.locator('[name=password]').fill('LOCAL-SPRINT-REVIEW-123456789');form.get_by_role('button',name='Sign in',exact=True).click()
   expect(page.locator('#league-list')).to_contain_text('LOCAL QA DRAFT')
   page.get_by_role('link',name='Goatville city',exact=True).click();expect(page).to_have_url(base+'/goatville-city.html')
   page.get_by_role('link',name='BULLPEN · AUTHORIZED SEATS ONLY',exact=False).click();expect(page.locator('#workspace')).to_be_hidden()
   form=page.locator('#login');form.locator('[name=email]').fill('sprint-browser@fixture.invalid');form.locator('[name=password]').fill('LOCAL-SPRINT-REVIEW-123456789');form.get_by_role('button',name='Enter Bullpen',exact=False).click();expect(page.locator('#notice')).to_contain_text('bullpen membership required')
   expect(page.locator('#workspace')).to_be_hidden();report['checks'].append('390px touch emulation: arrival → city → league → create account → create draft → reload/login → draft retained → city → ordinary-user Bullpen denial')
   context.close()
   context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=context.new_page();page.goto(base+'/goatville-city.html');page.get_by_role('link',name='OPEN LEAGUE WORKSPACE',exact=False).click();expect(page).to_have_url(base+'/games');context.close()
   report['checks'].append('City headquarters links reach workspace with JavaScript disabled')
  finally:browser.close()
 assert not report['page_errors'],report['page_errors'];assert not report['http_errors'],report['http_errors']

with tempfile.TemporaryDirectory(prefix='goatverse-sprint-browser-') as data:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}'
 code="import {application} from './backend/server.mjs';const app=await application({mode:'local',appEnv:'development',localPath:process.argv[1],appOrigin:process.argv[2],publicSiteEnabled:true,paymentsEnabled:false,authEmailEnabled:false,tiers:{}});app.server.listen(Number(process.argv[3]),'127.0.0.1');process.on('SIGTERM',async()=>{await app.close();process.exit(0)});"
 with (out/'server.log').open('w') as log:
  process=subprocess.Popen(['node','--input-type=module','-e',code,data+'/db',base,str(port)],cwd=root,stdout=log,stderr=log)
  try:
   await_server(process,base);run(base);report['result']='passed'
  except Exception as e:report['result']='failed';report['failure']=str(e);raise
  finally:
   stop(process);(out/'browser-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'result':report.get('result'),'layouts':len(report['layouts']),'checks':report['checks'],'failure':report.get('failure')}))
