import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "./auth.server";

function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export const checkCaseDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        type: z.enum(["birth", "death"]),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fatherBn: z.string().trim().min(1).max(100),
        motherBn: z.string().trim().min(1).max(100),
        excludeId: z.string().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        db
          .from("profiles")
          .select("active, upazila_id, union_id, ward")
          .eq("id", context.userId)
          .maybeSingle(),
        db.from("user_roles").select("role").eq("user_id", context.userId),
      ]);

    if (profileError) throw new Error(`Could not verify worker profile: ${profileError.message}`);
    if (rolesError) throw new Error(`Could not verify worker role: ${rolesError.message}`);
    if (
      !profile?.active ||
      !profile.upazila_id ||
      !profile.union_id ||
      profile.ward === null ||
      !roles?.some((role) => role.role === "worker")
    ) {
      throw new Error("Only active health workers with an assigned area can check case duplicates");
    }

    const normalize = normalizeName;
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: matches, error } = await db
        .from("cases")
        .select("id, father_bn, mother_bn")
        .eq("type", data.type)
        .eq("dob", data.dob)
        .eq("upazila_id", profile.upazila_id)
        .eq("union_id", profile.union_id)
        .eq("ward", profile.ward)
        .order("created_at")
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`Could not check for duplicate cases: ${error.message}`);
      if (
        (matches ?? []).some(
          (match) =>
            match.id !== data.excludeId &&
            normalize(match.father_bn) === normalize(data.fatherBn) &&
            normalize(match.mother_bn) === normalize(data.motherBn),
        )
      ) {
        return { duplicate: true };
      }
      if ((matches?.length ?? 0) < pageSize) return { duplicate: false };
    }
  });
