import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { useApp } from "@/lib/store";
import { ModuleNavigation } from "@/components/modules/ModuleNavigation";
import { ReviewListPage } from "@/components/modules/ReviewListPage";

export const Route = createFileRoute("/review-list")({
  head: () => ({
    meta: [
      { title: "Review list — E-Registration Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewRoute,
});

function ReviewRoute() {
  const { L, user } = useApp();
  return (
    <DashboardGate>
      {user && (user.role === "admin" || user.role === "uno") ? (
        <ReviewListPage />
      ) : (
        <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
          <ModuleNavigation />
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            {L("এই পাতায় প্রবেশের অনুমতি নেই", "You don't have access to this page")}
          </p>
        </main>
      )}
    </DashboardGate>
  );
}
