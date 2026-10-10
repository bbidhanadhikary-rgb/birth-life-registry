import { createFileRoute } from "@tanstack/react-router";
import { RegistrationDashboard } from "@/components/dashboards/RegistrationDashboard";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "National E-Registration Tracker — Birth & Death Registration" },
      {
        name: "description",
        content: "A national view of administrative progress in birth and death registration.",
      },
      { property: "og:title", content: "National E-Registration Tracker" },
      {
        property: "og:description",
        content: "A national view of administrative progress in birth and death registration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useApp();
  const role = user?.role === "super" ? "uno" : user?.role ?? "public";
  return <RegistrationDashboard role={role} />;
}
