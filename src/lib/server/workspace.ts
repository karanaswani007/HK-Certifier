import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { createId, uniqueSlug } from "@/lib/certifier/ids";
import type { WorkspaceSnapshot } from "@/lib/certifier/types";
import { parseLimits } from "@/lib/certifier/limits";
import {
  getMembership,
  getPlanLimits,
  getUsage,
  isPlatformAdmin,
  writeAudit,
} from "./helpers";
import { DEMO_ORG_ID, ensurePlatformSeed } from "./seed";

async function loadUserMeta(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ name: string; email: string; image: string | null }>`
    select name, email, image from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? { name: "Account", email: "", image: null };
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WorkspaceSnapshot> => {
    const sql = await getSql();
    await ensurePlatformSeed(sql);
    const meta = await loadUserMeta(context.userId);

    await sql`
      insert into profiles (user_id, email, name, image)
      values (${context.userId}, ${meta.email}, ${meta.name}, ${meta.image})
      on conflict (user_id) do update set
        email = excluded.email,
        name = excluded.name,
        image = excluded.image,
        updated_at = now()
    `;

    const adminCount = await sql<{ n: number }>`select count(*)::int as n from platform_admins`;
    if ((adminCount[0]?.n ?? 0) === 0) {
      await sql`insert into platform_admins (user_id) values (${context.userId}) on conflict do nothing`;
      await writeAudit(sql, {
        userId: context.userId,
        action: "platform.admin.bootstrap",
        resource: "platform_admins",
        resourceId: context.userId,
      });
    }

    const admin = await isPlatformAdmin(sql, context.userId);
    let membership = await getMembership(sql, context.userId);

    if (!membership) {
      const demo = await sql<{ created_by: string | null }>`
        select created_by from organizations where id = ${DEMO_ORG_ID}
      `;
      if (demo[0] && (demo[0].created_by === "system" || demo[0].created_by == null)) {
        await sql`
          update organizations set created_by = ${context.userId}, updated_at = now()
          where id = ${DEMO_ORG_ID}
        `;
        await sql`
          insert into organization_members (id, organization_id, user_id, role)
          values (${createId("mem")}, ${DEMO_ORG_ID}, ${context.userId}, ${"ORGANIZATION_OWNER"})
          on conflict (organization_id, user_id) do nothing
        `;
        await writeAudit(sql, {
          organizationId: DEMO_ORG_ID,
          userId: context.userId,
          action: "organization.claimed",
          resource: "organization",
          resourceId: DEMO_ORG_ID,
        });
        membership = await getMembership(sql, context.userId);
      }
    }

    if (!membership) {
      return {
        userId: context.userId,
        email: meta.email,
        name: meta.name,
        isPlatformAdmin: admin,
        organization: null,
        needsOnboarding: true,
        subscription: null,
        usage: { certificates: 0, emails: 0, students: 0, programs: 0, templates: 0, members: 0 },
      };
    }

    const orgRows = await sql<{
      id: string;
      name: string;
      slug: string;
      type: string;
      status: import("@/lib/certifier/types").OrgStatus;
      logo_url: string | null;
      official_email: string | null;
      phone: string | null;
      website: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      contact_person: string | null;
      description: string | null;
      brand_color: string | null;
      rejection_reason: string | null;
    }>`
      select id, name, slug, type, status, logo_url, official_email, phone, website,
             city, state, country, contact_person, description, brand_color, rejection_reason
      from organizations where id = ${membership.orgId}
    `;
    const org = orgRows[0]!;
    const limits = await getPlanLimits(sql, org.id);
    const usage = await getUsage(sql, org.id);
    const sub = await sql<{
      plan_id: string;
      name: string;
      status: string;
      period_start: string | null;
      period_end: string | null;
    }>`
      select s.plan_id, p.name, s.status, s.period_start::text, s.period_end::text
      from subscriptions s
      join subscription_plans p on p.id = s.plan_id
      where s.organization_id = ${org.id}
      order by s.created_at desc
      limit 1
    `;

    return {
      userId: context.userId,
      email: meta.email,
      name: meta.name,
      isPlatformAdmin: admin,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        status: org.status,
        logoUrl: org.logo_url,
        officialEmail: org.official_email,
        phone: org.phone,
        website: org.website,
        city: org.city,
        state: org.state,
        country: org.country,
        contactPerson: org.contact_person,
        description: org.description,
        brandColor: org.brand_color,
        rejectionReason: org.rejection_reason,
        role: membership.role,
      },
      needsOnboarding: false,
      subscription: sub[0]
        ? {
            planId: sub[0].plan_id,
            planName: sub[0].name,
            status: sub[0].status,
            periodStart: sub[0].period_start,
            periodEnd: sub[0].period_end,
            limits,
          }
        : { planId: "plan_free", planName: "Free", status: "ACTIVE", periodStart: null, periodEnd: null, limits },
      usage,
    };
  });

const orgSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.string().min(2).max(60),
  officialEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
  address: z.string().max(240).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  contactPerson: z.string().max(80).optional(),
  description: z.string().max(1000).optional(),
});

export const registerOrganization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: z.infer<typeof orgSchema>) => orgSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensurePlatformSeed(sql);
    const existing = await getMembership(sql, context.userId);
    if (existing) throw new Error("You already belong to an organization.");
    const id = createId("org");
    const slug = uniqueSlug(data.name);
    await sql`
      insert into organizations (
        id, name, slug, type, official_email, phone, website, address, city, state, country,
        contact_person, description, status, created_by
      ) values (
        ${id}, ${data.name}, ${slug}, ${data.type}, ${data.officialEmail || null}, ${data.phone || null},
        ${data.website || null}, ${data.address || null}, ${data.city || null}, ${data.state || null},
        ${data.country || "India"}, ${data.contactPerson || null}, ${data.description || null},
        ${"PENDING_APPROVAL"}, ${context.userId}
      )
    `;
    await sql`
      insert into organization_members (id, organization_id, user_id, role)
      values (${createId("mem")}, ${id}, ${context.userId}, ${"ORGANIZATION_OWNER"})
    `;
    await sql`
      insert into subscriptions (id, organization_id, plan_id, status, period_start, period_end)
      values (${createId("sub")}, ${id}, ${"plan_free"}, ${"ACTIVE"}, now(), now() + interval '1 month')
    `;
    await writeAudit(sql, {
      organizationId: id,
      userId: context.userId,
      action: "organization.registered",
      resource: "organization",
      resourceId: id,
    });
    return { id, status: "PENDING_APPROVAL" as const };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: z.infer<typeof orgSchema>) => orgSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    if (!["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"].includes(membership.role)) {
      throw new Error("Only owners and admins can update the organization.");
    }
    await sql`
      update organizations set
        name = ${data.name},
        type = ${data.type},
        official_email = ${data.officialEmail || null},
        phone = ${data.phone || null},
        website = ${data.website || null},
        address = ${data.address || null},
        city = ${data.city || null},
        state = ${data.state || null},
        country = ${data.country || "India"},
        contact_person = ${data.contactPerson || null},
        description = ${data.description || null},
        updated_at = now()
      where id = ${membership.orgId}
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "organization.updated",
      resource: "organization",
      resourceId: membership.orgId,
    });
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      body: string | null;
      href: string | null;
      read_at: string | null;
      created_at: string;
    }>`
      select id, title, body, href, read_at::text, created_at::text
      from notifications where user_id = ${context.userId}
      order by created_at desc limit 20
    `;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read_at = now() where user_id = ${context.userId} and read_at is null`;
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) return [];
    return sql<{
      id: string;
      action: string;
      resource: string | null;
      resource_id: string | null;
      created_at: string;
      user_id: string | null;
    }>`
      select id, action, resource, resource_id, created_at::text, user_id
      from audit_logs where organization_id = ${membership.orgId}
      order by created_at desc limit 100
    `;
  });

export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensurePlatformSeed(sql);
  const rows = await sql<Parameters<typeof parseLimits>[0] & {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_inr: number;
  }>`
    select id, name, slug, description, price_inr,
           monthly_certificates, monthly_emails, max_students, max_programs, max_templates,
           max_team_members, storage_mb, advanced_analytics, ai_generation, custom_branding,
           bulk_operations, api_access, priority_support, white_label
    from subscription_plans where is_public = true
    order by sort_order asc
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    priceInr: r.price_inr,
    limits: parseLimits(r),
  }));
});
