/**
 * Format a date string (YYYY-MM-DD) as a short weekday name.
 * Optionally returns todayLabel/tomorrowLabel when the date matches.
 */
export function formatDayName(
  dateStr: string,
  locale: string,
  todayLabel?: string,
  tomorrowLabel?: string,
): string {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');

    if (todayLabel || tomorrowLabel) {
      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const diff = (date.getTime() - todayUtc) / 86400_000;
      if (todayLabel && diff >= 0 && diff < 1) return todayLabel;
      if (tomorrowLabel && diff >= 1 && diff < 2) return tomorrowLabel;
    }

    return date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
  } catch {
    return dateStr;
  }
}
