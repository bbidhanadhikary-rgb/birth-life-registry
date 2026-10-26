import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDhakaMonthYear } from "@/lib/monthly-targets";
import { readDemoRegistrationTargets } from "@/lib/registration-targets";
import { loadAssignedStationRegistrationTarget } from "@/lib/registration-targets.functions";
import { useApp } from "@/lib/store";

type AssignedTarget = {
  unionId: string;
  monthYear: string;
  birth: number;
  death: number;
};

export function useAssignedRegistrationTarget() {
  const { L, user, demoMode } = useApp();
  const [target, setTarget] = useState<AssignedTarget | null>(null);

  useEffect(() => {
    const stationId = user?.stationId ?? user?.unionId;
    if (
      !user ||
      !["admin", "worker", "police"].includes(user.role) ||
      !stationId
    ) {
      setTarget(null);
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const monthYear = getDhakaMonthYear();
    const refresh = async () => {
      try {
        if (demoMode) {
          const saved = readDemoRegistrationTargets(user.upazilaId, monthYear)
            .find((item) => item.union_id === stationId && item.status === "submitted");
          if (active) {
            setTarget(saved ? {
              unionId: saved.union_id,
              monthYear,
              birth: saved.birth_target,
              death: saved.death_target,
            } : null);
          }
          return;
        }

        const result = await loadAssignedStationRegistrationTarget({ data: { monthYear } });
        if (active) setTarget(result.target);
      } catch (error) {
        if (!active) return;
        console.error("Failed to load station monthly targets", error);
        toast.error(L("স্টেশনের মাসিক লক্ষ্যমাত্রা লোড করা যায়নি", "Could not load station monthly targets"));
      }
    };

    setTarget(null);
    void refresh();

    if (demoMode) {
      const key = `monitoring-union-targets:${user.upazilaId}:${monthYear}`;
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) void refresh();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        active = false;
        window.removeEventListener("storage", onStorage);
      };
    }

    const channel = supabase
      .channel(`station-registration-target-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registration_targets",
          filter: `upazila_id=eq.${user.upazilaId}`,
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => void refresh(), 150);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Station registration target subscription failed", status);
          toast.error(L("লাইভ লক্ষ্যমাত্রা সংযোগ ব্যর্থ হয়েছে", "Live target connection failed"));
        }
      });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [L, demoMode, user]);

  return target;
}
