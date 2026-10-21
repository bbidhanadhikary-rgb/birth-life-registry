import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { NationalDashboard } from "@/components/dashboards/NationalDashboard";
import { ModuleNavigation } from "@/components/modules/ModuleNavigation";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Executive monitoring — E-Registration Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MonitoringRoute,
});

function MonitoringRoute() {
  const { L, user } = useApp();
  const canMonitor = user && ["uno", "district", "super"].includes(user.role);
  return (
    <DashboardGate developmentPreviewRole="uno">
      {canMonitor ? (
        <>
          <div className="mx-auto w-full max-w-none px-4 pt-4 sm:px-6 lg:px-8">
            <ModuleNavigation />
          </div>
          <NationalDashboard />
        </>
      ) : (
        <main className="mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
          <ModuleNavigation />
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            {L(
              "এই পর্যবেক্ষণ পাতা উচ্চপর্যায়ের কর্মকর্তাদের জন্য সীমাবদ্ধ।",
              "Executive monitoring is restricted to authorized officials.",
            )}
          </p>
        </main>
      )}
    </DashboardGate>
  );
}
