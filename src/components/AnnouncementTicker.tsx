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
      aria-label={L("বিজ্ঞপ্তি", "Announcement")}
    >
      <div className="mx-auto flex w-full max-w-none items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          to="/announcements"
          aria-label={L("সব বিজ্ঞপ্তি দেখুন", "View all announcements")}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-900/35 px-2.5 py-1 text-sm font-bold text-white transition hover:bg-emerald-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          <span>{L("বিজ্ঞপ্তি", "Notice")}</span>
        </Link>
        <span className="hidden shrink-0 text-sm font-semibold text-white min-[420px]:inline">
          {noticeArea ? L(noticeArea.bn, noticeArea.en) : L("সারা বাংলাদেশ", "Nationwide")}
        </span>
        <div
          className="announcement-viewport min-w-0 flex-1 overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={text}
          aria-live="polite"
          role="group"
          tabIndex={0}
        >
          <div className="announcement-track whitespace-nowrap text-base font-semibold leading-snug text-white sm:text-lg">
            <span className="announcement-item">{text}</span>
            <span className="announcement-item" aria-hidden="true">
              {text}
            </span>
          </div>
        </div>
        <Link
          to="/announcements"
          className="shrink-0 rounded px-1.5 py-1 text-xs font-bold text-white underline-offset-2 hover:bg-white/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-2 sm:text-sm"
        >
          {L("সব নোটিশ", "All notices")}
        </Link>
      </div>
    </div>
  );
}
