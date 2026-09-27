import type { PlanLimits } from "./types";

export const UNLIMITED = 1_000_000_000;

export const DEFAULT_FREE_LIMITS: PlanLimits = {
  monthlyCertificates: 25,
  monthlyEmails: 25,
  maxStudents: 50,
  maxPrograms: 3,
  maxTemplates: 3,
  maxTeamMembers: 2,
  storageMb: 200,
  advancedAnalytics: false,
  aiGeneration: false,
  customBranding: false,
  bulkOperations: true,
  apiAccess: false,
  prioritySupport: false,
  whiteLabel: false,
};

export function parseLimits(row: {
  monthly_certificates: number;
  monthly_emails: number;
  max_students: number;
  max_programs: number;
  max_templates: number;
  max_team_members: number;
  storage_mb: number;
  advanced_analytics: boolean;
  ai_generation: boolean;
  custom_branding: boolean;
  bulk_operations: boolean;
  api_access: boolean;
  priority_support: boolean;
  white_label: boolean;
}): PlanLimits {
  return {
    monthlyCertificates: row.monthly_certificates,
    monthlyEmails: row.monthly_emails,
    maxStudents: row.max_students,
    maxPrograms: row.max_programs,
    maxTemplates: row.max_templates,
    maxTeamMembers: row.max_team_members,
    storageMb: row.storage_mb,
    advancedAnalytics: row.advanced_analytics,
    aiGeneration: row.ai_generation,
    customBranding: row.custom_branding,
    bulkOperations: row.bulk_operations,
    apiAccess: row.api_access,
    prioritySupport: row.priority_support,
    whiteLabel: row.white_label,
  };
}

export type LimitCheck = { ok: true } | { ok: false; code: string; message: string };

export function assertWithinLimit(
  used: number,
  limit: number,
  needed: number,
  label: string,
): LimitCheck {
  if (limit >= UNLIMITED) return { ok: true };
  if (used + needed > limit) {
    return {
      ok: false,
      code: "PLAN_LIMIT",
      message: `${label} limit reached (${used}/${limit}). Upgrade your plan to continue.`,
    };
  }
  return { ok: true };
}

export function remaining(used: number, limit: number): number {
  if (limit >= UNLIMITED) return UNLIMITED;
  return Math.max(0, limit - used);
}

export function usagePercent(used: number, limit: number): number {
  if (limit >= UNLIMITED) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}
