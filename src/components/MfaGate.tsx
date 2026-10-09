import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { generateRecoveryCodes, logSecurityEvent, useRecoveryCode } from "@/lib/auth.functions";
import { useApp } from "@/lib/store";

export function RecoveryCodes() {
  const { L } = useApp();
  const gen = useServerFn(generateRecoveryCodes);
  const [codes, setCodes] = useState<string[]>([]);
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={async () => { const r = await gen(); if (r.ok) setCodes(r.codes); }}>{L("নতুন রিকভারি কোড তৈরি", "Generate new recovery codes")}</Button>
      {codes.length > 0 && (
        <div className="rounded-lg border border-warning bg-warning/10 p-3">
          <p className="mb-2 text-sm font-medium">{L("এগুলো নিরাপদে লিখে রাখুন — আর দেখানো হবে না। প্রতিটি একবার ব্যবহারযোগ্য।", "Save these safely — they won't be shown again. Each works once.")}</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <span key={c}>{c}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export function MfaGate() {
  const { L, mfa, refreshAuth, logout } = useApp();
  const log = useServerFn(logSecurityEvent), recover = useServerFn(useRecoveryCode);
  const [qr, setQr] = useState(""); const [secret, setSecret] = useState(""); const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState(""); const [rc, setRc] = useState(""); const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    (async () => {
      if (mfa === "enroll") {
        const { data: f } = await supabase.auth.mfa.listFactors();
        for (const x of f?.all ?? []) if (x.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: x.id });
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `app-${Date.now()}` });
        if (error) { toast.error(error.message); return; }
        setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
      } else {
        const { data } = await supabase.auth.mfa.listFactors();
        setFactorId(data?.totp[0]?.id ?? "");
      }
    })();
  }, [mfa]);

  const verify = async () => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { toast.error(L("কোড সঠিক নয়", "Invalid code")); return; }
    await log({ data: { action: mfa === "enroll" ? "mfa:enrolled" : "mfa:verified" } });
    if (mfa === "enroll") setEnrolled(true); else await refreshAuth();
  };

  if (enrolled) return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="font-display text-2xl font-bold">{L("২-ধাপ যাচাই চালু হয়েছে", "2-step verification is on")}</h1>
      <RecoveryCodes />
      <Button onClick={() => refreshAuth()}>{L("ড্যাশবোর্ডে যান", "Continue to dashboard")}</Button>
    </div>
  );
  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="font-display text-2xl font-bold">{mfa === "enroll" ? L("২-ধাপ যাচাই সেট করুন", "Set up 2-step verification") : L("২-ধাপ যাচাই", "2-step verification")}</h1>
      <p className="text-sm text-muted-foreground">{mfa === "enroll"
        ? L("আপনার ভূমিকার জন্য এটি বাধ্যতামূলক। Google Authenticator বা অনুরূপ অ্যাপে QR কোড স্ক্যান করুন।", "Required for your role. Scan the QR code with Google Authenticator or a similar app.")
        : L("অথেনটিকেটর অ্যাপের ৬ অঙ্কের কোড দিন।", "Enter the 6-digit code from your authenticator app.")}</p>
      {mfa === "enroll" && qr && <div className="space-y-2"><img src={qr} alt="QR" className="h-48 w-48 rounded bg-card p-2" /><code className="block break-all text-xs">{secret}</code></div>}
      <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      <Button className="w-full" disabled={code.length !== 6 || !factorId} onClick={verify}>{L("যাচাই করুন", "Verify")}</Button>
      {mfa === "challenge" && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm">{L("অ্যাপ হারিয়েছেন? রিকভারি কোড দিন:", "Lost your app? Use a recovery code:")}</p>
          <Input placeholder="XXXXX-XXXXX" value={rc} onChange={(e) => setRc(e.target.value)} />
          <Button variant="outline" onClick={async () => {
            const r = await recover({ data: { code: rc } });
            if (!r.ok) { toast.error(L("কোড সঠিক নয় বা লক করা", "Invalid or locked")); return; }
            toast.success(L("নতুন অথেনটিকেটর সেট করুন", "Now set up a new authenticator"));
            await supabase.auth.refreshSession(); await refreshAuth();
          }}>{L("রিকভারি কোড ব্যবহার", "Use recovery code")}</Button>
        </div>
      )}
      <button className="text-sm underline" onClick={() => logout()}>{L("লগআউট", "Log out")}</button>
    </div>
  );
}
