// Offline only. Never queries Supabase, sends email, changes standings or emits
// raw private player/commissioner snapshots to logs.
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {auditFiveGameCandidate} from '../games/release-gates.mjs';

async function main() {
  if (process.argv.length !== 3 || !process.argv[2].toLowerCase().endsWith('.json'))
    throw new Error('usage: node backend/scripts/audit-five-games.mjs <private-snapshots.json>');
  const filename=resolve(process.argv[2]);
  const metadata=await stat(filename);
  if (!metadata.isFile() || metadata.size > 4*1024*1024 || metadata.size < 2)
    throw new Error('snapshot_file_invalid');
  let input;
  try { input=JSON.parse(await readFile(filename,'utf8')); }
  catch { throw new Error('snapshot_json_invalid'); }
  // A reviewed annual season mapping can be supplied explicitly without
  // assuming that calendar-year and sports-season labels coincide.
  const snapshots=Array.isArray(input)?input:input?.snapshots;
  const seasonByGame=Array.isArray(input)?undefined:input?.season_by_game;
  const report=auditFiveGameCandidate(snapshots,{seasonByGame});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  // Manual approval can never be achieved by this local file check:
  // code 2 = prepared for external review; code 1 = blocked.
  process.exitCode=report.data_prepared?2:1;
}
main().catch(e=>{
  // Never print source JSON, access tokens, private records, or filesystem paths.
  process.stderr.write(['snapshot_file_invalid','snapshot_json_invalid'].includes(e.message)?e.message+'\n':
    'five_game_audit_unavailable\n');
  process.exitCode=1;
});
