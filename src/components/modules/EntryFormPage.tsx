import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { RegForm } from "@/components/dashboards/Worker";
import { ModuleNavigation } from "./ModuleNavigation";
import { useApp } from "@/lib/store";

export function EntryFormPage({ type }: { type: "birth" | "death" }) {
  const { L, user } = useApp();
  const navigate = useNavigate();

  if (user?.role !== "worker") {
    return (
      <div className="mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
        <ModuleNavigation />
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h1 className="font-semibold">
            {L("এই পাতায় প্রবেশের অনুমতি নেই", "You don't have access to this page")}
          </h1>
          <p className="mt-1 text-sm">
            {L(
              "শুধু স্বাস্থ্যকর্মীরা নতুন নিবন্ধন তথ্য জমা দিতে পারবেন।",
              "Only health workers may submit new registration data.",
            )}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-none px-4 py-3 sm:px-6 lg:px-8">
      <Link
        to="/dashboard"
        className="mb-2 inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {L("ড্যাশবোর্ডে ফিরে যান", "Back to dashboard")}
      </Link>
      <ModuleNavigation />
      <div className={type === "birth" ? "w-full max-w-full space-y-1" : "space-y-3"}>
        <RegForm
          key={type}
          type={type}
          onSaved={() => void navigate({ to: "/dashboard" })}
          onCancel={() => void navigate({ to: "/dashboard" })}
        />
      </div>
    </div>
  );
}
