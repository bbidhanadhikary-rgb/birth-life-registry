import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Headphones, Languages, LogIn, LogOut, Moon, Sun, Landmark, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { roleLabel, useApp } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { passwordSignIn, requestPasswordReset, sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth.functions";

export function Header() {
  const { user, L, lang, toggleLang, dark, toggleTheme, logout, online } = useApp();
  const [dlg, setDlg] = useState<null | "login" | "manual" | "support">(null);
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-warning px-3 py-1 text-xs font-medium text-warning-foreground">
          <WifiOff className="h-3 w-3" /> {L("অফলাইন — তথ্য ডিভাইসে জমা থাকবে, অনলাইনে এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে", "Offline — entries are cached and will auto-sync")}
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
        <Link to="/" className="mr-auto flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Landmark className="h-5 w-5" /></span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold">{L("ই-নিবন্ধন ট্র্যাকার", "E-Registration Tracker")}</span>
            <span className="hidden text-xs text-muted-foreground sm:block">{L("জন্ম ও মৃত্যু নিবন্ধন · উপজেলা", "Birth & Death · Upazila")}</span>
          </span>
        </Link>
        <Button variant="ghost" size="sm" onClick={toggleLang} aria-label="Language">
          <Languages className="h-4 w-4" /><span className="ml-1">{lang === "bn" ? "EN" : "বাং"}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        <Button variant="ghost" size="icon" onClick={() => setDlg("manual")} aria-label="Manual"><BookOpen className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDlg("support")} aria-label="Support"><Headphones className="h-4 w-4" /></Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-40 truncate">{L(user.name.bn, user.name.en)}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>{L(user.name.bn, user.name.en)}</div>
                <div className="text-xs font-normal text-muted-foreground">{roleLabel(user.role, L)}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav({ to: "/dashboard" })}>{L("ড্যাশবোর্ড", "Dashboard")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav({ to: "/security" })}>{L("নিরাপত্তা ও সেশন", "Security & sessions")}</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await logout(); nav({ to: "/", replace: true }); }}>
                <LogOut className="mr-2 h-4 w-4" />{L("লগআউট", "Logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" onClick={() => setDlg("login")}><LogIn className="mr-1 h-4 w-4" />{L("লগইন", "Login")}</Button>
        )}
      </div>
      <LoginDialog open={dlg === "login"} onClose={() => setDlg(null)} />
      <ManualDialog open={dlg === "manual"} onClose={() => setDlg(null)} />
      <SupportDialog open={dlg === "support"} onClose={() => setDlg(null)} />
    </header>
  );
}

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L, n } = useApp();
  const nav = useNavigate();
  const sendOtp = useServerFn(sendPhoneOtp), verifyOtp = useServerFn(verifyPhoneOtp);
  const pwSignIn = useServerFn(passwordSignIn), reset = useServerFn(requestPasswordReset);
  const [mobile, setMobile] = useState(""); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (r: { error?: string; lockedMinutes?: number }) => {
    if (r.error === "locked" || r.error === "too_many")
      toast.error(L(`অনেকবার চেষ্টা করা হয়েছে। ${n(r.lockedMinutes ?? 15)} মিনিট পর আবার চেষ্টা করুন`, `Too many attempts. Try again in ${r.lockedMinutes ?? 15} minutes`));
    else if (r.error === "bad_phone") toast.error(L("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)", "Enter a valid mobile number (01XXXXXXXXX)"));
    else if (r.error === "sms_failed") toast.error(L("SMS পাঠানো যায়নি, পরে চেষ্টা করুন", "Could not send SMS, try later"));
    else toast.error(L("তথ্য সঠিক নয়", "Details are incorrect"));
  };
  const done = async (tokens: { access_token: string; refresh_token: string }) => {
    const { error } = await supabase.auth.setSession(tokens);
    if (error) { toast.error(error.message); return; }
    onClose(); setSent(false); setOtp(""); setPw(""); nav({ to: "/dashboard" });
  };
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{L("লগইন করুন", "Sign in")}</DialogTitle>
          <DialogDescription>{L("আপনার ভূমিকা অনুযায়ী ড্যাশবোর্ড স্বয়ংক্রিয়ভাবে খুলবে", "Your role-specific dashboard opens automatically")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="otp">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="otp">{L("মোবাইল ও OTP", "Mobile & OTP")}</TabsTrigger>
            <TabsTrigger value="pw">{L("পাসওয়ার্ড", "Password")}</TabsTrigger>
          </TabsList>
          <TabsContent value="otp" className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{L("স্বাস্থ্যকর্মী ও গ্রাম পুলিশের জন্য", "For Health Workers & Village Police")}</p>
            <Label>{L("মোবাইল নম্বর", "Mobile number")}</Label>
            <Input inputMode="numeric" maxLength={11} value={mobile} disabled={sent} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="017XXXXXXXX" />
            {sent ? (<>
              <Label>{L("৬ অঙ্কের কোড", "6-digit code")}</Label>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              <Button className="w-full" disabled={busy || otp.length !== 6} onClick={() => run(async () => {
                const r = await verifyOtp({ data: { mobile, code: otp } }); if (r.ok) await done(r.tokens); else fail(r);
              })}>{L("যাচাই করুন", "Verify")}</Button>
              <button className="text-sm text-primary underline" onClick={() => { setSent(false); setOtp(""); }}>{L("নম্বর বদলান / আবার পাঠান", "Change number / resend")}</button>
            </>) : <Button className="w-full" disabled={busy || mobile.length !== 11} onClick={() => run(async () => {
              const r = await sendOtp({ data: { mobile } });
              if (r.ok) { setSent(true); toast.success(L("নিবন্ধিত হলে আপনার মোবাইলে কোড পাঠানো হয়েছে", "If registered, a code was sent to your mobile")); } else fail(r);
            })}>{L("OTP পাঠান", "Send OTP")}</Button>}
          </TabsContent>
          <TabsContent value="pw" className="space-y-3 pt-2">
            {forgot ? (<>
              <Label>{L("ইমেইল", "Email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button className="w-full" disabled={busy} onClick={() => run(async () => {
                await reset({ data: { email } });
                toast.success(L("অ্যাকাউন্ট থাকলে একটি রিসেট লিংক পাঠানো হয়েছে (১ ঘণ্টা মেয়াদি)", "If the account exists, a reset link was sent (valid 1 hour)"));
                setForgot(false);
              })}>{L("রিসেট লিংক পাঠান", "Send reset link")}</Button>
              <button className="text-sm text-primary underline" onClick={() => setForgot(false)}>{L("ফিরে যান", "Back")}</button>
            </>) : (<>
              <p className="text-xs text-muted-foreground">{L("প্রশাসনিক কর্মকর্তা, ইউএনও ও সুপার অ্যাডমিনের জন্য", "For Admin Officers, UNOs & Super Admins")}</p>
              <Label>{L("ইমেইল", "Email")}</Label>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Label>{L("পাসওয়ার্ড", "Password")}</Label>
              <Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Button className="w-full" disabled={busy || !email || !pw} onClick={() => run(async () => {
                const r = await pwSignIn({ data: { email, password: pw } }); if (r.ok) await done(r.tokens); else fail(r);
              })}>{L("লগইন", "Login")}</Button>
              <button className="text-sm text-primary underline" onClick={() => setForgot(true)}>{L("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}</button>
            </>)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L } = useApp();
  const steps: [string, string[]][] = [
    [L("ইপিআই / স্বাস্থ্যকর্মী", "EPI / Health Worker"), [
      L("মোবাইল ও OTP দিয়ে লগইন করুন", "Log in with mobile & OTP"),
      L("জন্ম বা মৃত্যু ফর্ম বেছে নিন, বাংলা ও ইংরেজি ঘর পূরণ করুন", "Pick birth/death form, fill Bangla & English boxes"),
      L("শুধু গ্রাম বেছে নিন — বাকি ঠিকানা নিজে বসে যাবে", "Pick the village only — the rest of the address fills itself"),
      L("৩টি পর্যন্ত কাগজ যুক্ত করে জমা দিন; অফলাইনেও কাজ করে", "Attach up to 3 documents and submit; works offline"),
    ]],
    [L("প্রশাসনিক কর্মকর্তা", "Administrative Officer"), [
      L("ইউনিয়নের সব আবেদন দেখুন, মন্তব্য ও অবস্থা হালনাগাদ করুন", "Review union cases, add remarks, update status"),
      L("গ্রাম পুলিশকে যাচাইয়ের কাজ দিন", "Assign verification to Village Police"),
      L("সরকারি নিবন্ধন নম্বর দিয়ে কেস সম্পন্ন করুন", "Close cases with the Government Registration Number"),
    ]],
    [L("গ্রাম পুলিশ", "Village Police"), [
      L("নির্ধারিত বাড়ির তালিকা দেখুন", "See assigned houses"),
      L("কাগজ সংগ্রহের চেকলিস্ট টিক দিন ও 'সংগ্রহ সম্পন্ন' চাপুন", "Tick the checklist and tap 'Documents Collected'"),
    ]],
    [L("ইউএনও", "UNO"), [
      L("সব ইউনিয়নের লক্ষ্যমাত্রা গ্রাফে দেখুন", "Track all unions against targets"),
      L("লাল চিহ্নিত নিষ্ক্রিয় এলাকা দেখুন ও ইউএনও মন্তব্য দিন", "Watch red-flagged areas, add UNO remarks"),
      L("মাস্টার রিপোর্ট ডাউনলোড করুন", "Download the master report"),
    ]],
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{L("ব্যবহার নির্দেশিকা", "User Manual")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {steps.map(([role, list]) => (
            <div key={role}>
              <h3 className="mb-1 font-semibold text-primary">{role}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">{list.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L } = useApp();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{L("সহায়তা কেন্দ্র", "Contact Support")}</DialogTitle>
          <DialogDescription>{L("উপজেলা আইসিটি / প্রশাসনিক সহায়তা দল", "Upazila ICT / Administrative support team")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button asChild variant="outline"><a href="tel:+8801700000000">📞 {L("কল করুন", "Call")} +880 1700-000000</a></Button>
          <Button asChild variant="outline"><a href="mailto:ict@upazila.gov.bd">✉️ ict@upazila.gov.bd</a></Button>
          <Button asChild variant="outline"><a href="https://wa.me/8801700000000" target="_blank" rel="noreferrer">💬 WhatsApp</a></Button>
          <p className="text-xs text-muted-foreground">{L("অফিস সময়: রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা", "Office hours: Sun–Thu, 9 AM – 5 PM")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
