import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bootstrapSuperAdmin, needsSetup } from "@/lib/auth.functions";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "First-time setup — E-Registration Tracker" }, { name: "description", content: "Create the first Super Admin." },
    { property: "og:title", content: "First-time setup" }, { property: "og:description", content: "Create the first Super Admin." }, { name: "robots", content: "noindex" }] }),
  component: Setup,
});

function Setup() {
  const { L } = useApp(); const nav = useNavigate();
  const check = useServerFn(needsSetup), boot = useServerFn(bootstrapSuperAdmin);
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [f, setF] = useState({ nameBn: "", nameEn: "", email: "", password: "" });
  useEffect(() => { check().then((r) => setNeeded(r.needed)); }, [check]);
  if (needed === null) return null;
  if (!needed) return <p className="py-20 text-center text-muted-foreground">{L("সেটআপ আগেই সম্পন্ন হয়েছে।", "Setup is already complete.")}</p>;
  return (
    <div className="mx-auto max-w-sm space-y-3 py-16">
      <h1 className="font-display text-2xl font-bold">{L("প্রথম সুপার অ্যাডমিন তৈরি", "Create the first Super Admin")}</h1>
      <Input placeholder="নাম (বাংলা)" value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} />
      <Input placeholder="Name (English)" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
      <Input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Input type="password" placeholder={L("পাসওয়ার্ড (১২+ অক্ষর)", "Password (12+ chars)")} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <Button className="w-full" onClick={async () => {
        try { const r = await boot({ data: f }); if (!r.ok) { toast.error(r.error); return; } } catch { toast.error(L("তথ্য সঠিক নয়", "Check the details")); return; }
        toast.success(L("তৈরি হয়েছে। এখন লগইন করুন।", "Created. Now sign in.")); nav({ to: "/" });
      }}>{L("তৈরি করুন", "Create")}</Button>
    </div>
  );
}
