import { LocalDatabase } from '../database.mjs';
import { configuration } from '../config.mjs';
const config = configuration();
if (config.mode !== 'local' || config.appEnv !== 'development') throw new Error('local_bootstrap_only');
const [userId,role]=process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(userId||'') || !['researcher','approver','executive'].includes(role)) throw new Error('usage: node backend/scripts/grant-local-role.mjs USER_UUID ROLE');
const db=await new LocalDatabase(config.localPath).init();
try {await db.db.query('insert into public.goat_roles(user_id,role) values($1,$2) on conflict do nothing',[userId,role]);console.log('Development role granted');} finally {await db.close();}
