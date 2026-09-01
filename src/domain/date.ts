/**
 * "Mar 04" — the short date the design uses everywhere a date appears.
 *
 * Dates are stored as ISO 8601 and formatted here at the point of display.
 * Storing them pre-formatted, as the prototype did, makes sorting by date a
 * string comparison that breaks across a year boundary.
 */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}
