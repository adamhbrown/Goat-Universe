// Import evidence-backed research produced by an authorized research workflow.
// Never sends messages, creates checkout sessions, or assigns commercial staff roles.
import { readFile } from 'node:fs/promises';
const [file]=process.argv.slice(2);
const origin=process.env.GOAT_BACKEND_ORIGIN||'http://localhost:8787';
const token=process.env.GOAT_RESEARCH_TOKEN;
if(!file||!token) throw new Error('research_file_and_authenticated_researcher_token_required');
const input=JSON.parse(await readFile(file,'utf8'));
if(!Array.isArray(input)||input.length>100) throw new Error('research_array_maximum_100');
for(const record of input){
 const response=await fetch(new URL('/commands',origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...record,op:'crm_prospect'}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();
 if(!response.ok) throw new Error(result.error||'research_import_failed');
 console.log(JSON.stringify({id:result.id,organization:record.organization,status:result.status}));
}
