import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const monthYearSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Month must be the first day of a valid month");
const monthInput = z.object({ monthYear: monthYearSchema });
const targetInput = z.object({
  monthYear: monthYearSchema,
  status: z.enum(["draft", "submitted"]),
  targets: z
    .array(
      z.object({
        unionId: z.string().trim().min(1).max(160),
        birthTarget: z.number().int().min(0).max(2_147_483_647),
        deathTarget: z.number().int().min(0).max(2_147_483_647),
      }),
    )
    .min(1)
    .max(500),
});

type AuthContext = {
  claims: Record<string, unknown>;
  supabase: SupabaseClient<Database>;
  userId: string;
};

async function getActiveProfile(context: AuthContext, expectedRole: "uno" | "admin") {
  if (context.claims["aal"] !== "aal2") {
    throw new Error("Multi-factor authentication is required");
  }

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
    await Promise.all([
      context.supabase
        .from("profiles")
        .select("active, upazila_id, union_id")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);

  if (profileError) throw new Error(`Could not verify profile: ${profileError.message}`);
  if (rolesError) throw new Error(`Could not verify role: ${rolesError.message}`);
  if (!profile?.active || !roles?.some((role) => role.role === expectedRole)) {
    throw new Error(`An active ${expectedRole} account is required`);
  }
  if (!profile.upazila_id) throw new Error("The account has no assigned Upazila");
  return profile as { active: boolean; upazila_id: string; union_id: string | null };
}

const getUpazilaUnions = async (context: AuthContext, upazilaId: string) => {
  const { data, error } = await context.supabase
    .from("upazilas")
    .select("unions")
    .eq("id", upazilaId)
    .single();
  if (error) throw new Error(`Could not load Upazila unions: ${error.message}`);

  return z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        bn: z.string().optional(),
        en: z.string().optional(),
      }),
    )
    .parse(data.unions);
};

export const loadUpazilaRegistrationTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => monthInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await getActiveProfile(context, "uno");
    const { data: targets, error } = await context.supabase
      .from("registration_targets")
      .select("union_id, birth_target, death_target, status, updated_at")
      .eq("upazila_id", profile.upazila_id)
      .eq("month_year", data.monthYear);
    if (error) throw new Error(`Could not load registration targets: ${error.message}`);
    return { targets: targets ?? [] };
  });

export const saveUpazilaRegistrationTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => targetInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await getActiveProfile(context, "uno");
    const unions = await getUpazilaUnions(context, profile.upazila_id);
    const unionIds = new Set(unions.map((union) => union.id));
    const requestedIds = data.targets.map((target) => target.unionId);
    if (
      new Set(requestedIds).size !== requestedIds.length ||
      requestedIds.length !== unionIds.size ||
      requestedIds.some((unionId) => !unionIds.has(unionId))
    ) {
      throw new Error("Targets must include each union in the assigned Upazila exactly once");
    }

    const rows = data.targets.map((target) => {
      const union = unions.find((item) => item.id === target.unionId);
      return {
        upazila_id: profile.upazila_id,
        union_id: target.unionId,
        union_name: union?.bn || union?.en || target.unionId,
        month_year: data.monthYear,
        birth_target: target.birthTarget,
        death_target: target.deathTarget,
        status: data.status,
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await context.supabase
      .from("registration_targets")
      .upsert(rows, { onConflict: "upazila_id,union_id,month_year,status" });
    if (error) throw new Error(`Could not save registration targets: ${error.message}`);
    return { saved: rows.length };
  });

export const loadSecretaryRegistrationTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => monthInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await getActiveProfile(context, "admin");
    if (!profile.union_id) throw new Error("The account has no assigned union");

    const { data: target, error } = await context.supabase
      .from("registration_targets")
      .select("union_id, month_year, birth_target, death_target")
      .eq("upazila_id", profile.upazila_id)
      .eq("union_id", profile.union_id)
      .eq("month_year", data.monthYear)
      .eq("status", "submitted")
      .maybeSingle();
    if (error) throw new Error(`Could not load union registration target: ${error.message}`);
    return {
      target: target
        ? {
            unionId: target.union_id,
            monthYear: target.month_year,
            birth: target.birth_target,
            death: target.death_target,
          }
        : null,
    };
  });
