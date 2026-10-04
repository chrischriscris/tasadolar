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
