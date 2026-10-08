import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, ClipboardCheck, ShieldCheck, BarChart3, WifiOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upazila E-Registration Tracker — Birth & Death Registration" },
      { name: "description", content: "Bilingual multi-upazila system to reach 100% birth and death registration targets." },
      { property: "og:title", content: "Upazila E-Registration Tracker" },
      { property: "og:description", content: "Bilingual multi-upazila system to reach 100% birth and death registration targets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { L, user } = useApp();
  const feats = [
    [Baby, L("সহজ দ্বিভাষিক ফর্ম", "Simple bilingual forms"), L("বাংলা ও ইংরেজি পাশাপাশি, গ্রাম বাছলেই পূর্ণ ঠিকানা", "Bangla & English side by side, full address from the village")],
    [ClipboardCheck, L("প্রশাসনিক যাচাই", "Admin verification"), L("মন্তব্য, অবস্থা ও সরকারি নিবন্ধন নম্বর", "Remarks, status and Govt. registration number")],
    [ShieldCheck, L("গ্রাম পুলিশ চেকলিস্ট", "Village Police checklist"), L("এক চাপে কাগজ সংগ্রহ নিশ্চিত", "Confirm document collection in one tap")],
    [BarChart3, L("ইউএনও বিশ্লেষণ", "UNO analytics"), L("ইউনিয়নভিত্তিক লক্ষ্যমাত্রা ও লাল সতর্কতা", "Union targets and red-flag alerts")],
    [WifiOff, L("অফলাইন সিঙ্ক", "Offline sync"), L("নেটওয়ার্ক ছাড়াও তথ্য জমা, পরে স্বয়ংক্রিয় সিঙ্ক", "Enter data offline, auto-sync later")],
    [Lock, L("কঠোর তথ্য সুরক্ষা", "Strict data isolation"), L("এক উপজেলা/ইউনিয়নের তথ্য অন্যরা দেখতে পায় না", "One area's data is invisible to others")],
  ] as const;
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-hero">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{L("লক্ষ্য: ১০০% নিবন্ধন", "Goal: 100% registration")}</span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">{L("প্রতিটি জন্ম ও মৃত্যু — নিবন্ধিত, নিশ্চিত।", "Every birth and death — registered, assured.")}</h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">{L("স্বাস্থ্যকর্মী থেকে ইউএনও পর্যন্ত এক প্ল্যাটফর্মে উপজেলার জন্ম ও মৃত্যু নিবন্ধন ট্র্যাকিং।", "Track upazila birth and death registration on one platform — from health workers to the UNO.")}</p>
            <div className="mt-6 flex gap-3">
              {user ? <Button size="lg" asChild><Link to="/dashboard">{L("ড্যাশবোর্ডে যান", "Go to dashboard")}</Link></Button>
                : <p className="text-sm text-muted-foreground">{L("উপরের 'লগইন' বোতাম চেপে শুরু করুন।", "Use the 'Login' button above to begin.")}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            {[["১৮", "18", L("ইউনিয়ন/পৌরসভা", "Unions/Municipality")], ["৫০", "50", L("মাসিক জন্ম লক্ষ্য", "Monthly birth target")], ["২০", "20", L("মাসিক মৃত্যু লক্ষ্য", "Monthly death target")], ["৪", "4", L("ব্যবহারকারী ভূমিকা", "User roles")]].map(([b, e, l]) => (
              <div key={l} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="font-display text-4xl font-bold text-primary">{L(b!, e!)}</div>
                <div className="text-sm text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {feats.map(([Icon, t, d]) => (
          <div key={t} className="rounded-2xl border border-border bg-card p-5">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
