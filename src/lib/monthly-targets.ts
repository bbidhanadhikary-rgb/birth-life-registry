export function getDhakaMonthYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new Error("Could not determine the current Bangladesh month");
  }
  return `${year}-${month}-01`;
}

export function getCompletionPercent(
  achievedBirth: number,
  achievedDeath: number,
  targetBirth: number,
  targetDeath: number,
): number {
  const totalTarget = targetBirth + targetDeath;
  return totalTarget > 0
    ? Math.round(((achievedBirth + achievedDeath) / totalTarget) * 100)
    : 0;
}
