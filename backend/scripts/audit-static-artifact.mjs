import {auditStaticArtifact} from '../static-artifact.mjs';
try {
  if (process.argv.length !== 3) throw new Error('artifact_directory_required');
  const report = await auditStaticArtifact(process.argv[2]);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'passed' ? 0 : 1;
} catch {
  // Avoid filesystem/provider error messages that could echo sensitive input.
  console.log(JSON.stringify({status:'blocked', diagnosis:'readable_public_export_directory_required'}));
  process.exitCode = 2;
}
