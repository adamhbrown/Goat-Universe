import {managementStatus} from '../management-status.mjs';
const report=await managementStatus();
console.log(JSON.stringify(report,null,2));
// Passing this narrow GET does not establish Auth/email/RLS or launch readiness.
process.exitCode=report.authentication==='accepted'?0:report.authentication==='not_checked'?2:1;
