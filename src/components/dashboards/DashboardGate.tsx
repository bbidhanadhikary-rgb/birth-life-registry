import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/Header";
import { MfaGate } from "@/components/MfaGate";
import { useApp } from "@/lib/store";

export function DashboardGate({
  children,
  workerLayout = true,
}: {
  children: ReactNode;
  workerLayout?: boolean;
}) {
  const { user, L, authReady, mfa } = useApp();
  const [loginOpen, setLoginOpen] = useState(false);

  if (!authReady) {
    return (
      <div
        className="mx-auto w-full max-w-none space-y-4 px-4 py-8 sm:px-6 lg:px-8"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{L("ড্যাশবোর্ড লোড হচ্ছে", "Loading dashboard")}</span>
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>
    );
  }
  if (user && mfa !== "ok") return <MfaGate />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="mb-4 text-muted-foreground">
          {L("ড্যাশবোর্ড দেখতে লগইন করুন", "Please log in to view your dashboard")}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => setLoginOpen(true)}>{L("লগইন", "Sign in")}</Button>
          <Button variant="outline" asChild>
            <Link to="/">{L("হোম", "Home")}</Link>
          </Button>
        </div>
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === "worker" && workerLayout) {
    return (
      <div className="h-[calc(100svh-6.6rem)] min-h-0 overflow-hidden px-4 py-1 sm:px-6 sm:py-2 lg:px-8">
        {children}
      </div>
    );
  }

  return <div className="mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}
