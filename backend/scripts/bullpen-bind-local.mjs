import { LocalDatabase } from '../database.mjs';
import { configuration } from '../config.mjs';

// Stop the development server before opening its single-process PGlite path.
// This grants a seat to an EXISTING account; it never creates shared passwords.
const config = configuration();
if (config.mode !== 'local' || config.appEnv !== 'development') throw new Error('local_bootstrap_only');
const [seat, userId] = process.argv.slice(2);
if (!['adam','tiffany','pope','codex'].includes(seat) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '')) {
  throw new Error('usage: node backend/scripts/bullpen-bind-local.mjs SEAT EXISTING_USER_UUID');
}
const db = await new LocalDatabase(config.localPath).init();
try {
  await db.db.transaction(async tx => {
    const old = (await tx.query('select user_id from bullpen_private.seats where id=$1 for update',[seat])).rows[0];
    if (old.user_id && old.user_id !== userId) throw new Error('existing_seat_binding_preserved');
    await tx.query('update bullpen_private.seats set user_id=$1,enabled=true where id=$2',[userId,seat]);
  });
  console.log('Local development seat bound. Hosted access is not configured.');
} finally { await db.close(); }
