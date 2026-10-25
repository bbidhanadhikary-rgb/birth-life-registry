import { useEffect, useState, type FormEvent } from "react";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/store";

type NoticeKind = "notice" | "message" | "directive";
type Notice = {
  id: string;
  upazila_id: string;
  union_id: string | null;
  author_id: string;
  title: string;
  body: string;
  kind: NoticeKind;
  published_at: string;
};

const DEMO_NOTICES_KEY = "monitoring-notices";
const noticeKinds: NoticeKind[] = ["notice", "message", "directive"];

function readDemoNotices(upazilaId: string): Notice[] {
  try {
    const stored = localStorage.getItem(`${DEMO_NOTICES_KEY}:${upazilaId}`);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Notice =>
      typeof item === "object" && item !== null &&
      "id" in item && typeof item.id === "string" &&
      "upazila_id" in item && typeof item.upazila_id === "string" &&
      "union_id" in item && (typeof item.union_id === "string" || item.union_id === null) &&
      "author_id" in item && typeof item.author_id === "string" &&
      "title" in item && typeof item.title === "string" &&
      "body" in item && typeof item.body === "string" &&
      "kind" in item && noticeKinds.includes(item.kind as NoticeKind) &&
      "published_at" in item && typeof item.published_at === "string",
    ).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  } catch (error) {
    console.error("Failed to read demo monitoring notices", error);
    return [];
  }
}

function readAllDemoNotices(): Notice[] {
  const noticeKeys = Object.keys(localStorage).filter((key) => key.startsWith(`${DEMO_NOTICES_KEY}:`));
  return noticeKeys
    .flatMap((key) => readDemoNotices(key.slice(DEMO_NOTICES_KEY.length + 1)))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

function writeDemoNotices(upazilaId: string, notices: Notice[]) {
  try {
    localStorage.setItem(`${DEMO_NOTICES_KEY}:${upazilaId}`, JSON.stringify(notices));
    return true;
  } catch (error) {
    console.error("Failed to save demo monitoring notices", error);
    return false;
  }
}

export function MonitoringNoticeBoard() {
  const { L, demoMode, user } = useApp();
  const upazilaId = user?.upazilaId;
  const unionId = user?.role === "admin" ? user.unionId ?? null : null;
  const isGlobalViewer = user?.role === "district" || user?.role === "super";
  const canPublish = user?.role === "uno" || user?.role === "admin";
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<NoticeKind>("notice");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!upazilaId && !isGlobalViewer) {
      setNotices([]);
      setLoading(false);
      return;
    }
    if (demoMode) {
      setNotices(isGlobalViewer ? readAllDemoNotices() : readDemoNotices(upazilaId!));
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void (async () => {
      let noticeQuery = supabase
        .from("monitoring_notices")
        .select("id, upazila_id, union_id, author_id, title, body, kind, published_at")
        .order("published_at", { ascending: false });
      if (!isGlobalViewer) noticeQuery = noticeQuery.eq("upazila_id", upazilaId!);
      const { data, error } = await noticeQuery;
      if (!active) return;
      if (error) {
        console.error("Failed to load monitoring notices", error);
        toast.error(L("নোটিশ বোর্ড লোড করা যায়নি", "Could not load the notice board"));
      } else {
        setNotices((data ?? []) as Notice[]);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [L, demoMode, isGlobalViewer, upazilaId]);

  const visibleNotices = notices.filter((notice) =>
    isGlobalViewer || (
      notice.upazila_id === upazilaId &&
      (notice.union_id === null || notice.union_id === user?.unionId || user?.role === "uno")
    ),
  );

  const publishNotice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!user || !upazilaId || !canPublish || publishing) return;
    if (!cleanTitle || !cleanBody) {
      toast.error(L("শিরোনাম ও বার্তা লিখুন", "Enter a title and message"));
      return;
    }
    setPublishing(true);
    const notice: Notice = {
      id: crypto.randomUUID(),
      upazila_id: upazilaId,
      union_id: unionId,
      author_id: user.id,
      title: cleanTitle,
      body: cleanBody,
      kind,
      published_at: new Date().toISOString(),
    };

    try {
      if (demoMode) {
        const nextNotices = [notice, ...readDemoNotices(upazilaId)];
        if (!writeDemoNotices(upazilaId, nextNotices)) throw new Error("Local notice save failed");
      } else {
        const { data, error } = await supabase
          .from("monitoring_notices")
          .insert({
            upazila_id: notice.upazila_id,
            union_id: notice.union_id,
            author_id: notice.author_id,
            title: notice.title,
            body: notice.body,
            kind: notice.kind,
          })
          .select("id, upazila_id, union_id, author_id, title, body, kind, published_at")
          .single();
        if (error) throw error;
        setNotices((current) => [data as Notice, ...current]);
      }
      if (demoMode) setNotices((current) => [notice, ...current]);
      setTitle("");
      setBody("");
      setKind("notice");
      toast.success(L("নোটিশ সফলভাবে প্রকাশিত হয়েছে", "Notice published successfully"));
    } catch (error) {
      console.error("Failed to publish monitoring notice", error);
      toast.error(L("নোটিশ প্রকাশ করা যায়নি", "Could not publish the notice"));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {canPublish && (
        <form className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5" onSubmit={(event) => void publishNotice(event)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{L("অফিসিয়াল নোটিশ প্রকাশ", "Publish an official notice")}</h3>
            <span className="text-xs text-muted-foreground">
              {user?.role === "admin"
                ? L("শুধু নিজ ইউনিয়নের কর্মকর্তারা দেখবেন", "Visible to your union only")
                : L("উপজেলার সব কর্মকর্তা দেখবেন", "Visible throughout your Upazila")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <label className="space-y-1 text-sm font-medium">
              {L("ধরন", "Type")}
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(event) => setKind(event.target.value as NoticeKind)}
              >
                <option value="notice">{L("নোটিশ", "Notice")}</option>
                <option value="message">{L("বার্তা", "Message")}</option>
                <option value="directive">{L("নির্দেশনা", "Directive")}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              {L("শিরোনাম", "Title")}
              <Input maxLength={180} required value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>
          <label className="space-y-1 text-sm font-medium">
            {L("বিস্তারিত বার্তা", "Message")}
            <Textarea maxLength={5000} required rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={publishing || !title.trim() || !body.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {publishing ? L("প্রকাশ হচ্ছে…", "Publishing…") : L("প্রকাশ করুন", "Publish")}
            </Button>
          </div>
        </form>
      )}

      <section className="min-h-0 flex-1 px-4 py-3 sm:px-5" aria-label={L("প্রকাশিত নোটিশ", "Published notices")}>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{L("প্রকাশিত নোটিশ", "Published notices")}</h3>
        {loading ? (
          <p className="py-5 text-sm text-muted-foreground">{L("নোটিশ লোড হচ্ছে…", "Loading notices…")}</p>
        ) : visibleNotices.length ? (
          <ol className="divide-y divide-slate-200 dark:divide-slate-700">
            {visibleNotices.map((notice) => (
              <li key={notice.id} className="py-4 first:pt-2">
                <article>
                  <div className="flex flex-wrap items-center gap-2">
                    <Megaphone className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {L(
                        notice.kind === "directive" ? "নির্দেশনা" : notice.kind === "message" ? "বার্তা" : "নোটিশ",
                        notice.kind === "directive" ? "Directive" : notice.kind === "message" ? "Message" : "Notice",
                      )}
                    </span>
                    <time className="text-xs text-muted-foreground" dateTime={notice.published_at}>
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notice.published_at))}
                    </time>
                  </div>
                  <h4 className="mt-1 font-semibold text-slate-950 dark:text-white">{notice.title}</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{notice.body}</p>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-y border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground dark:border-slate-700">
            {L("এখনো কোনো নোটিশ প্রকাশিত হয়নি", "No notices have been published yet")}
          </p>
        )}
      </section>
    </div>
  );
}