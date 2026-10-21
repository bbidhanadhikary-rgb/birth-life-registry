import type { RegCase } from "./types";

export const STATUTORY_DEADLINE_DAYS = 365;
export const NEAR_DEADLINE_DAYS = 30;
export const SAFE_DEADLINE_DAYS = 90;
export const WARNING_DEADLINE_DAYS = 180;
const DAY_MS = 86400000;
const LEGAL_TIME_ZONE = "Asia/Dhaka";
const dateParts = new Intl.DateTimeFormat("en", {
  timeZone: LEGAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type DeadlineStatus = "on-track" | "due-soon" | "overdue";

export interface CaseDeadline {
  eventDate: string;
  deadlineDate: string;
  elapsedDays: number;
  daysRemaining: number;
  status: DeadlineStatus;
}

export function getDeadlineBand(elapsedDays: number): "safe" | "warning" | "near-deadline" | "overdue" {
  if (elapsedDays <= SAFE_DEADLINE_DAYS) return "safe";
  if (elapsedDays <= WARNING_DEADLINE_DAYS) return "warning";
  if (elapsedDays <= STATUTORY_DEADLINE_DAYS) return "near-deadline";
  return "overdue";
}

function parseDateOnly(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year!, month! - 1, day!);
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime();
}

export function getCaseDeadline(c: RegCase, now = Date.now()): CaseDeadline | null {
  const eventDate = c.type === "birth" ? c.dob : c.dod;
  const eventTime = parseDateOnly(eventDate);
  if (eventTime === null) return null;

  const parts = Object.fromEntries(
    dateParts.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const todayTime = parseDateOnly(`${parts["year"]}-${parts["month"]}-${parts["day"]}`);
  if (todayTime === null) return null;
  if (eventTime > todayTime) return null;

  const elapsedDays = Math.floor((todayTime - eventTime) / DAY_MS);
  const deadlineTime = eventTime + STATUTORY_DEADLINE_DAYS * DAY_MS;
  const daysRemaining = Math.floor((deadlineTime - todayTime) / DAY_MS);
  const status: DeadlineStatus =
    daysRemaining < 0 ? "overdue" : daysRemaining <= NEAR_DEADLINE_DAYS ? "due-soon" : "on-track";

  return {
    eventDate: eventDate!,
    deadlineDate: new Date(deadlineTime).toISOString().slice(0, 10),
    elapsedDays,
    daysRemaining,
    status,
  };
}
