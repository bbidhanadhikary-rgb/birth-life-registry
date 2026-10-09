import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/Header";
import { useApp } from "@/lib/store";
import { WorkerDashboard } from "@/components/dashboards/Worker";
import { AdminDashboard } from "@/components/dashboards/Admin";
import { PoliceDashboard } from "@/components/dashboards/Police";
import { UnoDashboard } from "@/components/dashboards/Uno";
import { SuperDashboard } from "@/components/dashboards/Super";
import { MfaGate } from "@/components/MfaGate";

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
  const { user, L, authReady, mfa } = useApp();
  const [open, setOpen] = useState(false);
  if (!authReady) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (user && mfa !== "ok") return <MfaGate />;
  if (!user) return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="mb-4 text-muted-foreground">{L("ড্যাশবোর্ড দেখতে লগইন করুন", "Please log in to view your dashboard")}</p>
      <Button onClick={() => setOpen(true)}>{L("লগইন", "Login")}</Button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
  const D = { worker: WorkerDashboard, admin: AdminDashboard, police: PoliceDashboard, uno: UnoDashboard, super: SuperDashboard }[user.role];
  return <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6"><D /></div>;
}
