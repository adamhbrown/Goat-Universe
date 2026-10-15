import {auditBullpenCandidate} from '../bullpen/integration-gate.mjs';

try {
  const report=await auditBullpenCandidate();
  console.log(JSON.stringify(report,null,2));
  // This is a non-deployment evidence collector, never a launch certificate.
  process.exitCode=2;
} catch {
  console.log(JSON.stringify({status:'blocked_pending_approval_and_hosted_acceptance',scope:'offline_source_only',checks:[],connections_verified:0,mutations_performed:0}));
  process.exitCode=2;
}
