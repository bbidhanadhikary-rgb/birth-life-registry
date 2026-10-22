import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { WorkerApplicationListPage } from "@/components/modules/WorkerApplicationListPage";

export const Route = createFileRoute("/worker-applications/$type")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Registration applications — E-Registration Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkerApplicationsRoute,
});

function WorkerApplicationsRoute() {
  const { type } = Route.useParams();
  const registrationType = type === "birth" || type === "death" ? type : null;
  return (
    <DashboardGate workerLayout={false} developmentPreviewRole="worker">
      {registrationType ? (
        <WorkerApplicationListPage type={registrationType} />
      ) : (
        <p className="px-4 py-8 text-center text-muted-foreground">
          Unsupported application type.
        </p>
      )}
    </DashboardGate>
  );
}
