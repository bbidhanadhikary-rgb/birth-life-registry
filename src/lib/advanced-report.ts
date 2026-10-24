import type { RegCase, Status } from "@/lib/types";

export type AdvancedReportFilters = {
  type: "all" | RegCase["type"];
  status: "all" | Status;
  fromDate: string;
  toDate: string;
  thresholdDays: number | null;
};

export type AdvancedReportRow = {
  item: RegCase;
  registrationDate: string | null;
  daysFromBirth: number | null;
};

const dhakaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : null;
}

function dateOnlyAt(timestamp: number): string | null {
  if (!Number.isFinite(timestamp)) return null;
  return dhakaDateFormatter.format(timestamp);
}

function differenceInCalendarDays(laterDate: string, earlierDate: string): number | null {
  const later = parseDateOnly(laterDate);
  const earlier = parseDateOnly(earlierDate);
  return later === null || earlier === null
    ? null
    : Math.round((later - earlier) / 86_400_000);
}

export function getDaysFromBirth(item: RegCase): number | null {
  if (item.type !== "birth" || item.status !== "completed" || item.completedAt === undefined) {
    return null;
  }
  const registrationDate = dateOnlyAt(item.completedAt);
  return registrationDate ? differenceInCalendarDays(registrationDate, item.dob) : null;
}

export function filterAdvancedReport(
  cases: readonly RegCase[],
  filters: AdvancedReportFilters,
): AdvancedReportRow[] {
  const from = filters.fromDate ? parseDateOnly(filters.fromDate) : null;
  const to = filters.toDate ? parseDateOnly(filters.toDate) : null;
  const thresholdDays = filters.thresholdDays;
  const hasThreshold = thresholdDays !== null;
  if (
    (filters.fromDate && from === null) ||
    (filters.toDate && to === null) ||
    (from !== null && to !== null && from > to) ||
    (hasThreshold && (!Number.isInteger(thresholdDays) || thresholdDays < 0))
  ) {
    return [];
  }

  return cases.flatMap((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return [];
    if (filters.status !== "all" && item.status !== filters.status) return [];

    const registrationTimestamp =
      item.status === "completed" ? item.completedAt : item.createdAt;
    const registrationDate =
      registrationTimestamp === undefined ? null : dateOnlyAt(registrationTimestamp);
    if (filters.fromDate || filters.toDate) {
      if (!registrationDate) return [];
      const registrationDay = parseDateOnly(registrationDate);
      if (registrationDay === null || (from !== null && registrationDay < from) || (to !== null && registrationDay > to)) {
        return [];
      }
    }

    let daysFromBirth: number | null = null;
    if (hasThreshold) {
      if (thresholdDays === null) return [];
      if (item.type !== "birth" || item.status !== "completed") return [];
      daysFromBirth = getDaysFromBirth(item);
      if (
        daysFromBirth === null ||
        daysFromBirth < 0 ||
        daysFromBirth > thresholdDays
      ) {
        return [];
      }
    } else if (item.type === "birth" && item.status === "completed") {
      daysFromBirth = getDaysFromBirth(item);
    }

    return [{ item, registrationDate, daysFromBirth }];
  });
}
