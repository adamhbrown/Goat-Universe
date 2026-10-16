// Controlled remediation: remote migration execution is on hold.
// Removing this unconditional hold requires a separate reviewed change and approval.
// No environment variable or workflow-dispatch input can bypass it.
export function assertMigrationExecutionAllowed() {
  throw new Error('migration_execution_blocked_pending_review');
}
