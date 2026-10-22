import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RegistrationDashboard } from "@/components/dashboards/RegistrationDashboard";
import { useApp } from "@/lib/store";

export const PREVIEW_ROLES = ["main", "health_worker", "village_police", "up_official", "uno"] as const;
type PreviewRole = (typeof PREVIEW_ROLES)[number];
const DASHBOARD_ACTIONS = ["worker-report", "feedback"] as const;
type DashboardAction = (typeof DASHBOARD_ACTIONS)[number];
const roleMap = { health_worker: "worker", village_police: "police", up_official: "admin", uno: "uno" } as const;

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { role?: PreviewRole; action?: DashboardAction } => ({
    ...(PREVIEW_ROLES.includes(s["role"] as PreviewRole) && s["role"] !== "main"
      ? { role: s["role"] as PreviewRole }
      : {}),
    ...(DASHBOARD_ACTIONS.includes(s["action"] as DashboardAction)
      ? { action: s["action"] as DashboardAction }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "National E-Registration Tracker — Birth & Death Registration" },
      { name: "description", content: "A national view of administrative progress in birth and death registration." },
      { property: "og:title", content: "National E-Registration Tracker" },
      { property: "og:description", content: "A national view of administrative progress in birth and death registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { role: preview, action } = Route.useSearch();
  const role = user
    ? user.role === "super" ? "uno" : user.role
    : preview && preview !== "main" ? roleMap[preview] : "public";
  return (
    <RegistrationDashboard
      key={role}
      role={role}
      {...(action ? { initialAction: action } : {})}
      onActionDismiss={() => {
        void navigate({
          to: "/",
          search: (previous) => {
            const { action: _action, ...rest } = previous;
            return rest;
          },
        });
      }}
    />
  );
}
