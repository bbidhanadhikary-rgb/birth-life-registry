import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set password — E-Registration Tracker" }, { name: "description", content: "Set a new account password." },
    { property: "og:title", content: "Set password" }, { property: "og:description", content: "Set a new account password." }, { name: "robots", content: "noindex" }] }),
  component: Reset,
});

function Reset() {
  const { L } = useApp(); const nav = useNavigate();
  const [ready, setReady] = useState(false); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY" || e === "SIGNED_IN") setReady(true); });
    supabase.auth.getSession().then(({ data: d }) => { if (d.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const save = async () => {
    if (pw.length < 12) { toast.error(L("কমপক্ষে ১২ অক্ষর", "At least 12 characters")); return; }
    if (pw !== pw2) { toast.error(L("পাসওয়ার্ড মেলেনি", "Passwords don't match")); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    await supabase.auth.signOut({ scope: "global" });
    toast.success(L("পাসওয়ার্ড সেট হয়েছে। এখন লগইন করুন।", "Password set. Please sign in."));
    nav({ to: "/" });
  };
  return (
    <div className="mx-auto max-w-sm space-y-3 py-16">
      <h1 className="font-display text-2xl font-bold">{L("নতুন পাসওয়ার্ড", "New password")}</h1>
      {!ready ? <p className="text-muted-foreground">{L("লিংক যাচাই হচ্ছে… লিংকের মেয়াদ শেষ হলে আবার রিসেট চান।", "Checking link… if it expired, request a new reset.")}</p> : (<>
        <Input type="password" autoComplete="new-password" placeholder={L("নতুন পাসওয়ার্ড (১২+ অক্ষর)", "New password (12+ chars)")} value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input type="password" autoComplete="new-password" placeholder={L("আবার লিখুন", "Repeat")} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <Button className="w-full" onClick={save}>{L("সংরক্ষণ", "Save")}</Button>
      </>)}
    </div>
  );
}
