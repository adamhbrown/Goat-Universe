import {deploymentReadiness} from '../deployment-readiness.mjs';
const report=await deploymentReadiness();
console.log(JSON.stringify(report,null,2));
process.exitCode=report.status==='passed'?0:report.status==='failed'?1:2;
