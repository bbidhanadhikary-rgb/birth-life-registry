import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { EntryFormPage } from "@/components/modules/EntryFormPage";

export const Route = createFileRoute("/birth-registration")({
  validateSearch: (search: Record<string, unknown>) => ({
    applicationId:
      typeof search["applicationId"] === "string" ? search["applicationId"] : undefined,
    ...(search["role"] === "health_worker" ? { role: "health_worker" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Birth registration entry — E-Registration Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BirthRegistrationRoute,
});

function BirthRegistrationRoute() {
  const { applicationId, role } = Route.useSearch();
  return (
    <DashboardGate workerLayout={false}>
      <EntryFormPage type="birth" applicationId={applicationId} role={role} />
    </DashboardGate>
  );
}
