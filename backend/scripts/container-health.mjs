// No credentials in command arguments or logs. Health checks never mutate data.
try {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const response = await fetch(`http://127.0.0.1:${port}/health`, {signal:AbortSignal.timeout(6000)});
  const status = await response.json();
  if (!response.ok || status.status !== 'ok' || status.database_ok !== true || status.schema_version !== 4) throw new Error();
} catch {
  process.exitCode = 1;
}
