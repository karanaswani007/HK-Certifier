import type { Sql } from "@/lib/db";
import { createId, currentPeriod } from "@/lib/certifier/ids";
import { parseLimits } from "@/lib/certifier/limits";
import type { OrgRole, PlanLimits } from "@/lib/certifier/types";

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export async function writeAudit(
  sql: Sql,
  input: {
    organizationId?: string | null;
    userId?: string | null;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: unknown;
  },
) {
  await sql`
    insert into audit_logs (id, organization_id, user_id, action, resource, resource_id, metadata)
    values (
      ${createId("aud")},
      ${input.organizationId ?? null},
      ${input.userId ?? null},
      ${input.action},
      ${input.resource ?? null},
      ${input.resourceId ?? null},
      ${input.metadata ? JSON.stringify(input.metadata) : null}
    )
  `;
}

export async function notify(
  sql: Sql,
  input: { userId: string; organizationId?: string | null; title: string; body?: string; href?: string },
) {
  await sql`
    insert into notifications (id, user_id, organization_id, title, body, href)
    values (${createId("ntf")}, ${input.userId}, ${input.organizationId ?? null}, ${input.title}, ${input.body ?? null}, ${input.href ?? null})
  `;
}

export type MemberContext = {
  userId: string;
  orgId: string;
  role: OrgRole;
  orgStatus: string;
  orgName: string;
};

const WRITE_ROLES: OrgRole[] = ["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "ORGANIZATION_EDITOR"];
const ADMIN_ROLES: OrgRole[] = ["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"];

export async function getMembership(sql: Sql, userId: string, orgId?: string | null): Promise<MemberContext | null> {
  const rows = orgId
    ? await sql<{
        organization_id: string;
        role: OrgRole;
        status: string;
        name: string;
      }>`
        select m.organization_id, m.role, o.status, o.name
        from organization_members m
        join organizations o on o.id = m.organization_id
        where m.user_id = ${userId} and m.organization_id = ${orgId} and o.deleted_at is null
        limit 1
      `
    : await sql<{
        organization_id: string;
        role: OrgRole;
        status: string;
        name: string;
      }>`
        select m.organization_id, m.role, o.status, o.name
        from organization_members m
        join organizations o on o.id = m.organization_id
        where m.user_id = ${userId} and o.deleted_at is null
        order by m.created_at asc
        limit 1
      `;
  const row = rows[0];
  if (!row) return null;
  return {
    userId,
    orgId: row.organization_id,
    role: row.role,
    orgStatus: row.status,
    orgName: row.name,
  };
}

export function canWrite(role: OrgRole) {
  return WRITE_ROLES.includes(role);
}

export function canAdmin(role: OrgRole) {
  return ADMIN_ROLES.includes(role);
}

export async function requireApprovedOrg(ctx: MemberContext, write = false) {
  if (write && !canWrite(ctx.role)) {
    throw new Error("You do not have permission to make this change.");
  }
  if (ctx.orgStatus !== "APPROVED") {
    throw new Error("Organization is not approved for certificate operations.");
  }
}

export async function isPlatformAdmin(sql: Sql, userId: string) {
  const rows = await sql<{ user_id: string }>`select user_id from platform_admins where user_id = ${userId} limit 1`;
  return Boolean(rows[0]);
}

export async function getPlanLimits(sql: Sql, orgId: string): Promise<PlanLimits> {
  const rows = await sql<Parameters<typeof parseLimits>[0] & { plan_id: string }>`
    select p.monthly_certificates, p.monthly_emails, p.max_students, p.max_programs, p.max_templates,
           p.max_team_members, p.storage_mb, p.advanced_analytics, p.ai_generation, p.custom_branding,
           p.bulk_operations, p.api_access, p.priority_support, p.white_label, p.id as plan_id
    from subscriptions s
    join subscription_plans p on p.id = s.plan_id
    where s.organization_id = ${orgId} and s.status = 'ACTIVE'
    order by s.created_at desc
    limit 1
  `;
  if (!rows[0]) {
    const free = await sql<Parameters<typeof parseLimits>[0]>`
      select monthly_certificates, monthly_emails, max_students, max_programs, max_templates,
             max_team_members, storage_mb, advanced_analytics, ai_generation, custom_branding,
             bulk_operations, api_access, priority_support, white_label
      from subscription_plans where id = 'plan_free'
    `;
    return parseLimits(free[0]!);
  }
  return parseLimits(rows[0]);
}

export async function getUsage(sql: Sql, orgId: string) {
  const period = currentPeriod();
  const usage = await sql<{ certificates: number; emails: number }>`
    select certificates, emails from usage_counters
    where organization_id = ${orgId} and period = ${period}
  `;
  const students = await sql<{ n: number }>`select count(*)::int as n from students where organization_id = ${orgId} and archived = false`;
  const programs = await sql<{ n: number }>`select count(*)::int as n from programs where organization_id = ${orgId} and deleted_at is null`;
  const templates = await sql<{ n: number }>`select count(*)::int as n from certificate_templates where organization_id = ${orgId} and archived = false`;
  const members = await sql<{ n: number }>`select count(*)::int as n from organization_members where organization_id = ${orgId}`;
  return {
    certificates: usage[0]?.certificates ?? 0,
    emails: usage[0]?.emails ?? 0,
    students: students[0]?.n ?? 0,
    programs: programs[0]?.n ?? 0,
    templates: templates[0]?.n ?? 0,
    members: members[0]?.n ?? 0,
    period,
  };
}

export async function bumpUsage(
  sql: Sql,
  orgId: string,
  field: "certificates" | "emails",
  amount: number,
) {
  const period = currentPeriod();
  await sql`
    insert into usage_counters (organization_id, period, certificates, emails)
    values (${orgId}, ${period}, ${field === "certificates" ? amount : 0}, ${field === "emails" ? amount : 0})
    on conflict (organization_id, period) do update set
      certificates = usage_counters.certificates + excluded.certificates,
      emails = usage_counters.emails + excluded.emails
  `;
}

export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  let h = 0;
  for (let i = 0; i < ip.length; i += 1) h = (h * 31 + ip.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
