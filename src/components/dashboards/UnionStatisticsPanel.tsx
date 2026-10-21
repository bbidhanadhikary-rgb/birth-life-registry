import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TARGET, type RegCase, type Upazila } from "@/lib/types";
import { useApp } from "@/lib/store";
import { monthCount } from "../shared";
import { Button } from "@/components/ui/button";
import type { Union } from "@/lib/types";

interface UnionStatisticsPanelProps {
  upazila: Upazila;
  cases: RegCase[];
  unions?: Union[];
  selectedUnionId?: string;
  onUnionChange?: (id: string) => void;
  showUnionFilter?: boolean;
}

export function UnionStatisticsPanel({
  upazila,
  cases,
  unions = upazila.unions,
  selectedUnionId = "all",
  onUnionChange = () => {},
  showUnionFilter = true,
}: UnionStatisticsPanelProps) {
  const { L, n } = useApp();
  const visibleUnions = unions.filter(
    (union) => selectedUnionId === "all" || union.id === selectedUnionId,
  );
  const data = visibleUnions.map((union) => {
    const rows = cases.filter((c) => c.unionId === union.id);
    return {
      name: L(union.bn, union.en).replace(/^(\S+ (নং|No\.) )/, ""),
      births: monthCount(rows, "birth"),
      deaths: monthCount(rows, "death"),
    };
  });
  const chartWidth = Math.max(720, visibleUnions.length * 58);

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="union-statistics-title"
    >
      <h2 id="union-statistics-title" className="font-display text-xl font-bold">
        {L("ইউনিয়নভিত্তিক মাসিক লক্ষ্যমাত্রা", "Monthly targets by union")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {L(
          `${upazila.bn} উপজেলার ${n(upazila.unions.length)}টি ইউনিয়ন ও পৌরসভা · জন্ম লক্ষ্য ${n(TARGET.birth)}, মৃত্যু লক্ষ্য ${n(TARGET.death)}টি`,
          `${upazila.en} Upazila · ${upazila.unions.length} unions/municipality · monthly targets: ${TARGET.birth} births and ${TARGET.death} deaths`,
        )}
      </p>
      {showUnionFilter && (
        <div
          className="mb-2 flex max-w-full touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-2"
          role="group"
          aria-label={L("ইউনিয়ন পরিসংখ্যান ফিল্টার", "Filter union statistics")}
        >
          <Button
            type="button"
            size="sm"
            className="h-11 shrink-0"
            variant={selectedUnionId === "all" ? "default" : "outline"}
            aria-pressed={selectedUnionId === "all"}
            onClick={() => onUnionChange("all")}
          >
            {L("সব এলাকা", "All areas")}
          </Button>
          {unions.map((union) => (
            <Button
              key={union.id}
              type="button"
              size="sm"
              className="h-11 shrink-0"
              variant={selectedUnionId === union.id ? "default" : "outline"}
              aria-pressed={selectedUnionId === union.id}
              onClick={() => onUnionChange(union.id)}
            >
              {L(union.bn, union.en)}
            </Button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="h-80" style={{ minWidth: chartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                angle={-40}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11 }}
                height={54}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <ReferenceLine y={TARGET.birth} stroke="var(--color-primary)" strokeDasharray="4 4" />
              <ReferenceLine
                y={TARGET.death}
                stroke="var(--color-destructive)"
                strokeDasharray="4 4"
              />
              <Bar dataKey="births" name={L("জন্ম", "Births")} fill="var(--color-primary)" />
              <Bar dataKey="deaths" name={L("মৃত্যু", "Deaths")} fill="var(--color-chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
