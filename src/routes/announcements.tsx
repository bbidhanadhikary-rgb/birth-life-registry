import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Megaphone } from "lucide-react";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — E-Registration Tracker" },
      { name: "description", content: "Official birth and death registration notices." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { announcements, authReady, L, state } = useApp();
  const notices = announcements
    .filter((notice) => notice.active && (notice.noticeBn.trim() || notice.noticeEn.trim()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {L("মূল ড্যাশবোর্ডে ফিরুন", "Back to main dashboard")}
      </Link>
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white shadow-md">
            <Megaphone className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {L("সরকারি ঘোষণা", "Official announcements")}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              {L("জরুরি ঘোষণা ও নোটিশ বোর্ড", "Emergency announcements and notice board")}
            </h1>
          </div>
        </div>
      </header>

      {!authReady ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600" role="status">
          {L("নোটিশ লোড হচ্ছে…", "Loading notices…")}
        </p>
      ) : notices.length ? (
        <ul className="grid gap-4">
          {notices.map((notice) => {
            const area = state.upazilas.find((upazila) => upazila.id === notice.upazilaId);
            return (
              <li
                key={notice.upazilaId}
                className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <span className="font-semibold text-emerald-900">
                    {area ? L(area.bn, area.en) : L("সরকারি দপ্তর", "Government office")}
                  </span>
                  <time className="text-sm text-slate-500" dateTime={new Date(notice.updatedAt).toISOString()}>
                    {new Intl.DateTimeFormat(L("bn-BD", "en-GB"), {
                      dateStyle: "medium",
                      timeZone: "Asia/Dhaka",
                    }).format(notice.updatedAt)}
                  </time>
                </div>
                {notice.noticeBn.trim() && (
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                    {notice.noticeBn}
                  </p>
                )}
                {notice.noticeEn.trim() && (
                  <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
                    {notice.noticeEn}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          {L("এই মুহূর্তে কোনো সক্রিয় নোটিশ নেই।", "There are no active notices at this time.")}
        </p>
      )}
      </main>
    </>
  );
}
