// Display only: UTC instants remain unchanged. GST follows New York's DST rules.
export const GST_ZONE = 'America/New_York';
const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: GST_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
});
const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: GST_ZONE, month: 'short', day: 'numeric', year: 'numeric'
});
export function goatvilleTime(instant) {
  return {time: clockFormat.format(instant), date: dateFormat.format(instant), utc: instant.toISOString()};
}
export function formatGST(value) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return 'Time unavailable';
  const formatted = goatvilleTime(instant);
  return formatted.date + ' · ' + formatted.time + ' GST';
}
