const updatedAtFormatter = new Intl.DateTimeFormat("es-VE", {
  timeZone: "America/Caracas",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Absolute fetch time in Venezuelan time, e.g. "25 may., 6:03 a. m." */
export function formatUpdatedAt(date: Date): string {
  return updatedAtFormatter.format(date);
}

const effectiveDateFormatter = new Intl.DateTimeFormat("es-VE", {
  timeZone: "America/Caracas",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** BCV value date, e.g. "vie, 2 oct." */
export function formatEffectiveDate(iso: string): string {
  return effectiveDateFormatter.format(new Date(iso));
}
