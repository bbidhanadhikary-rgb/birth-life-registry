export const PREVIEW_ROLES = [
  "main",
  "health_worker",
  "village_police",
  "up_official",
  "up_secretary",
  "up_chairman",
  "municipal_secretary",
  "city_zonal_officer",
  "municipal_executive_officer",
  "uno",
  "ddlg",
  "dc",
  "ddlg_dc",
  "divisional_commissioner",
  "addl_registrar_general",
  "city_corporation_ceo",
  "registrar_general",
] as const;

export type PreviewRole = (typeof PREVIEW_ROLES)[number];

export const EXECUTIVE_PREVIEW_ROLES = [
  "municipal_executive_officer",
  "uno",
  "ddlg",
  "dc",
  "addl_registrar_general",
  "city_corporation_ceo",
  "divisional_commissioner",
  "registrar_general",
] as const satisfies readonly PreviewRole[];

export type ExecutivePreviewRole = (typeof EXECUTIVE_PREVIEW_ROLES)[number];

export const POLICY_READ_ONLY_ROLES = [
  "up_chairman",
  "municipal_secretary",
  "city_zonal_officer",
  "municipal_executive_officer",
  "uno",
  "ddlg",
  "dc",
  "ddlg_dc",
  "divisional_commissioner",
  "addl_registrar_general",
  "city_corporation_ceo",
  "registrar_general",
] as const satisfies readonly PreviewRole[];

export function isPolicyReadOnlyRole(value: unknown): value is (typeof POLICY_READ_ONLY_ROLES)[number] {
  return typeof value === "string" && POLICY_READ_ONLY_ROLES.some((role) => role === value);
}

export function isPreviewRole(value: unknown): value is PreviewRole {
  return typeof value === "string" && PREVIEW_ROLES.some((role) => role === value);
}
