import { BullpenClient } from '../bullpen/client.mjs';

// Credentials are supplied by the operator's secret store, never CLI arguments.
// read prints private project context; use only in the authorized workstream.
async function main() {
  const client = new BullpenClient({origin:process.env.BULLPEN_ORIGIN,accessToken:process.env.BULLPEN_ACCESS_TOKEN});
  const [action,arg] = process.argv.slice(2);
  if (action === 'read') {
    const cursor = Number(arg || 0);
    if (!Number.isSafeInteger(cursor) || cursor<0) throw new Error('invalid_cursor');
    console.log(JSON.stringify(await client.context(cursor),null,2));
  } else if (action === 'reply') {
    let content = '';
    for await (const chunk of process.stdin) { content += chunk; if (content.length>8000) throw new Error('message_too_large'); }
    const result = await client.reply({messageId:arg,content:content.trim(),clientId:process.env.BULLPEN_CLIENT_ID});
    console.log(JSON.stringify({message_id:result.id,seat:result.seat,recorded_at:result.created_at}));
  } else throw new Error('usage_read_CURSOR_or_reply_MESSAGE_ID_via_stdin');
}
main().catch(error => { console.error(/^[a-zA-Z0-9_]+$/.test(error.message) ? error.message : 'bullpen_client_failed'); process.exitCode = 1; });
