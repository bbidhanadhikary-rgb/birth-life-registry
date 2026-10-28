import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { WorkerApplicationListPage } from "@/components/modules/WorkerApplicationListPage";
import { BirthRegList } from "@/components/modules/BirthRegList";
import { DeathRegList } from "@/components/modules/DeathRegList";
import { useApp } from "@/lib/store";
import { AdministrativeErrorBoundary } from "@/components/AdministrativeErrorBoundary";

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
  const { user, cases, activeUnionId } = useApp();
  const registrationType = type === "birth" || type === "death" ? type : null;
  const unionId = activeUnionId ?? user?.unionId;
  const administrativeCases = unionId
    ? cases.filter((item) => item.unionId === unionId)
    : cases;
  return (
    <DashboardGate workerLayout={false} developmentPreviewRole="worker">
      {registrationType ? user?.role === "admin" ? (
        <AdministrativeErrorBoundary>
          {registrationType === "birth" ? (
            <BirthRegList cases={administrativeCases} onHome={() => window.history.back()} />
          ) : (
            <DeathRegList cases={administrativeCases} onHome={() => window.history.back()} />
          )}
        </AdministrativeErrorBoundary>
      ) : (
        <WorkerApplicationListPage type={registrationType} />
      ) : (
        <p className="px-4 py-8 text-center text-muted-foreground">
          Unsupported application type.
        </p>
      )}
    </DashboardGate>
  );
}
