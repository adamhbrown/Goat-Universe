import {stagingInfrastructure} from '../staging-infrastructure.mjs';
const report=await stagingInfrastructure();
console.log(JSON.stringify(report,null,2));
process.exitCode=report.status==='ready_for_migration_review'?0:2;
