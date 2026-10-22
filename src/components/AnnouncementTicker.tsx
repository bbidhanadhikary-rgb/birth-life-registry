import { Megaphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";

export function AnnouncementTicker() {
  const { L, announcements, state, user } = useApp();
  const notice = announcements.find(
    (item) =>
      item.active &&
      (item.noticeBn.trim() || item.noticeEn.trim()) &&
      item.upazilaId === user?.upazilaId,
  ) ?? announcements.find((item) => item.active && (item.noticeBn.trim() || item.noticeEn.trim()));
  const localizedNotice = notice ? L(notice.noticeBn, notice.noticeEn) : "";
  const text = localizedNotice.trim()
    ? localizedNotice
    : notice
      ? notice.noticeBn || notice.noticeEn
      : L(
        "জন্ম ও মৃত্যু নিবন্ধনে ৩৬৫ দিনের আইনি সময়সীমা মেনে চলুন · জাতীয় নিবন্ধন অগ্রগতি পর্যবেক্ষণ করুন",
        "Observe the 365-day birth and death registration mandate · Monitor nationwide registration progress",
      );
  const noticeArea = notice && state.upazilas.find((area) => area.id === notice.upazilaId);

  return (
    <div
      className="border-t border-emerald-500 bg-emerald-700 text-white"
      role="region"
      aria-label={L("সরকারি ঘোষণা", "Official announcement")}
    >
      <div className="mx-auto flex w-full max-w-none items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          to="/announcements"
          aria-label={L("সব সরকারি বিজ্ঞপ্তি দেখুন", "View all official announcements")}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          <span>{L("সরকারি বিজ্ঞপ্তি", "Official notice")}</span>
        </Link>
        <span className="shrink-0 text-xs text-emerald-50">
          {noticeArea ? L(noticeArea.bn, noticeArea.en) : L("সারা বাংলাদেশ", "Nationwide")}
        </span>
        <div className="announcement-viewport min-w-0 flex-1 overflow-hidden" aria-live="polite">
          <div className="announcement-track whitespace-nowrap text-sm font-medium">
            <span>{text}</span>
            <span className="mx-12" aria-hidden="true">
              {text}
            </span>
          </div>
        </div>
        <Link
          to="/announcements"
          className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-white underline-offset-2 hover:bg-white/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {L("সব নোটিশ", "All notices")}
        </Link>
      </div>
    </div>
  );
}
