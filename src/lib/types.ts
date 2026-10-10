export type Role = "worker" | "admin" | "police" | "uno" | "super";
export type Bi = { bn: string; en: string };

export interface Village { id: string; bn: string; en: string; poBn: string; poEn: string; ward: number }
export interface Union { id: string; bn: string; en: string; villages: Village[] }
export interface Upazila {
  id: string; bn: string; en: string;
  districtBn: string; districtEn: string; divisionBn: string; divisionEn: string;
  unions: Union[];
}

export interface AdministrativeArea {
  id: string;
  level:
    | "division"
    | "district"
    | "upazila"
    | "city_corporation"
    | "union"
    | "municipality"
    | "ward";
  bn: string;
  en: string;
  parentId: string | null;
  divisionId: string;
  districtId: string | null;
  municipalityId: string | null;
  upazilaId: string | null;
  cityCorporationId?: string | null;
  unionId: string | null;
  wardNumber: number | null;
  wardCount?: number;
  wardNumbers?: readonly number[];
}

export interface User {
  id: string; name: Bi; role: Role;
  mobile?: string | undefined; email?: string | undefined; password?: string;
  upazilaId: string; unionId?: string | undefined; ward?: number | undefined;
}

export interface Remark { by: string; role: Role; text: string; at: number }
export type Status = "pending" | "progress" | "completed";

export interface RegCase {
  id: string; type: "birth" | "death";
  name: Bi; father: Bi; mother: Bi;
  nid: string; // parent NID (birth) or deceased NID/BRN (death)
  parentMobile?: string | undefined;
  gender: "male" | "female" | "other";
  dob: string; order?: string | undefined; dod?: string | undefined; cause?: Bi | undefined;
  villageId: string;
  files: { name: string; size: number; path?: string }[]; filesPurged?: boolean | undefined;
  status: Status; regNo?: string | undefined;
  remarks: Remark[];
  police?: undefined | { epiCard: boolean; parentNid: boolean; collected: boolean; collectedAt?: number };
  createdBy: string; upazilaId: string; unionId: string; ward: number;
  createdAt: number; completedAt?: number | undefined; synced: boolean; smsSent: boolean;
}

export interface AuditEntry { at: number; userId: string; action: string; caseId?: string | undefined }

export interface AppState {
  upazilas: Upazila[]; users: User[]; cases: RegCase[]; audit: AuditEntry[];
  sessionId: string | null;
}

export const TARGET = { birth: 50, death: 20 };
