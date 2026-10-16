// Local integrated application only. Never reads hosted credentials or reuses
// the default .local/postgres database. No migrations contact a remote project.
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';
import {fileURLToPath} from 'node:url';
const config=configuration({BACKEND_MODE:'local',APP_ENV:'development',HOST:'127.0.0.1',PORT:'8787',PUBLIC_SITE_ENABLED:'true',
  LOCAL_DATABASE_PATH:fileURLToPath(new URL('../../.local/one-universe',import.meta.url))});
const app=await application(config);
app.server.once('error',async()=>{console.error('Local application could not bind port 8787. No other process was stopped.');await app.db.close();process.exitCode=1;});
app.server.listen(config.port,config.host,()=>{
  console.log('GOAT Universe: http://127.0.0.1:8787/');
  console.log('Integrated local development application. Data persists in its separate .local/one-universe directory.');
  console.log('Accounts: /manage | Five leagues: /games | Private room: /bullpen (seat binding required).');
  console.log('No hosted provider, live payments, email or official contest launch is enabled.');
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
