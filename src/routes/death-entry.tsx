import { createFileRoute } from "@tanstack/react-router";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { EntryFormPage } from "@/components/modules/EntryFormPage";

export const Route = createFileRoute("/death-entry")({
  head: () => ({
    meta: [
      { title: "Death registration entry — E-Registration Tracker" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DashboardGate workerLayout={false}>
      <EntryFormPage type="death" />
    </DashboardGate>
  ),
});
