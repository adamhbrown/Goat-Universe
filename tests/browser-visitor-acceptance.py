import argparse,json,subprocess,time,urllib.request
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--suite',choices=['all','goatville','resort'],default='all');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
out=root/'docs/late-night-qa';(out/'visitor').mkdir(exist_ok=True)
report={'scope':'Actual loopback-only starter and inherited visitor browser suites','checks':[]}
with (out/'starter.log').open('w') as log:
 app=subprocess.Popen(['node','backend/scripts/start-universe.mjs'],cwd=root,stdout=log,stderr=log)
 try:
  for _ in range(150):
   if app.poll() is not None:raise RuntimeError('starter_exited')
   try:
    with urllib.request.urlopen('http://127.0.0.1:8787/health',timeout=1) as r:health=json.load(r)
    break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('starter_timeout')
  assert health['database']=='local' and health['payments_enabled'] is False and health['auth_email_enabled'] is False
  report['health']=health
  for name in (['goatville','resort'] if args.suite=='all' else [args.suite]):
   with (out/f'visitor-{name}.log').open('w') as suite_log:
    result=subprocess.run(['python',f'tests/browser-{name}.py','--base-url','http://127.0.0.1:8787','--output-dir',str(out/'visitor'/name)],cwd=root,stdout=suite_log,stderr=suite_log,timeout=180)
    report['checks'].append({'suite':name,'exit_code':result.returncode})
  report['result']='passed' if all(c['exit_code']==0 for c in report['checks']) else 'failed'
 finally:
  app.terminate()
  try:app.wait(timeout=8)
  except subprocess.TimeoutExpired:app.kill();app.wait()
  (out/'starter-and-visitor-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
