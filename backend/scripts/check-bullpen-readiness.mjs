import {bullpenReadiness} from '../bullpen/readiness.mjs';
try {
  const report=await bullpenReadiness();
  console.log(JSON.stringify(report,null,2));
  // Incomplete is intentionally not a green launch or connection certificate.
  process.exitCode=report.status==='failed'?1:2;
} catch {
  console.log(JSON.stringify({status:'blocked',diagnosis:'bullpen_readiness_unavailable'}));process.exitCode=2;
}
