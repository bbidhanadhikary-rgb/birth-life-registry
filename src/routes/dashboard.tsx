import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RegistrationDashboard } from "@/components/dashboards/RegistrationDashboard";
import { SuperDashboard } from "@/components/dashboards/Super";
import { LoginDialog } from "@/components/Header";
import { MfaGate } from "@/components/MfaGate";
import { ModuleNavigation } from "@/components/modules/ModuleNavigation";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Upazila E-Registration Tracker" },
      { name: "description", content: "Role-based dashboard for birth and death registration tracking." },
      { property: "og:title", content: "Dashboard — Upazila E-Registration Tracker" },
      { property: "og:description", content: "Role-based dashboard for birth and death registration tracking." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, L, authReady, mfa, demoLoginAvailable, enterDemoLogin } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (authReady && demoLoginAvailable && !user) enterDemoLogin("worker");
  }, [authReady, demoLoginAvailable, enterDemoLogin, user]);

  if (!authReady || (demoLoginAvailable && !user)) {
    return <div className="py-20 text-center text-muted-foreground">…</div>;
  }
  if (user && mfa !== "ok") return <MfaGate />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="mb-4 text-muted-foreground">
          {L("ড্যাশবোর্ড দেখতে লগইন করুন", "Please log in to view your dashboard")}
        </p>
        <Button onClick={() => setOpen(true)}>{L("লগইন", "Login")}</Button>
        <LoginDialog open={open} onClose={() => setOpen(false)} />
      </div>
    );
  }

  if (user.role === "super") {
    return <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6"><ModuleNavigation /><SuperDashboard /></div>;
  }

  return <><div className="mx-auto max-w-7xl px-3 pt-3 sm:px-6"><ModuleNavigation /></div><RegistrationDashboard role={user.role} /></>;
}
