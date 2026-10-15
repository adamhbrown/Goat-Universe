import { randomUUID } from 'node:crypto';

// Permissioned HTTP adapter for an authorized external workstream. This is
// transport, not a model, autonomous worker, or bridge to ChatGPT session history.
export class BullpenClient {
  constructor({origin,accessToken,fetchImpl = fetch}) {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) throw new Error('https_origin_required');
    if (!accessToken || typeof accessToken !== 'string') throw new Error('access_token_required');
    this.origin = url.origin; this.token = accessToken; this.fetch = fetchImpl;
  }
  async request(path,p) {
    const response = await this.fetch(this.origin+path,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`},body:JSON.stringify(p),signal:AbortSignal.timeout(15000)});
    const result = await response.json();
    // Do not dump response bodies, credentials, URLs or runtime exceptions.
    if (!response.ok) throw new Error(/^[a-z][a-z0-9_]+$/.test(result.error) ? result.error : 'bullpen_request_failed');
    return result;
  }
  context(after = 0) { return this.request('/bullpen/query',{op:'poll',after}); }
  reply({messageId,content,clientId = randomUUID()}) {
    if (!Number.isSafeInteger(Number(messageId)) || Number(messageId)<1) throw new Error('message_id_required');
    return this.request('/bullpen/commands',{op:'message_post',source:'api',reply_to:messageId,content,client_id:clientId});
  }
}
