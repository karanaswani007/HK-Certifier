import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { createId } from "@/lib/certifier/ids";
import { parseLimits } from "@/lib/certifier/limits";
import { isPlatformAdmin, notify, writeAudit } from "./helpers";
import { ensurePlatformSeed } from "./seed";

async function requireAdmin(userId: string) {
  const sql = await getSql();
  await ensurePlatformSeed(sql);
  if (!(await isPlatformAdmin(sql, userId))) throw new Error("Admin access required.");
  return sql;
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    const row = await sql<{
      orgs: number;
      pending: number;
      approved: number;
      suspended: number;
      students: number;
      programs: number;
      certificates: number;
      month_certs: number;
      verifications: number;
      emails: number;
      paid: number;
      free: number;
      pending_pay: number;
      revenue: number;
    }>`
      select
        (select count(*)::int from organizations where deleted_at is null) as orgs,
        (select count(*)::int from organizations where status = 'PENDING_APPROVAL') as pending,
        (select count(*)::int from organizations where status = 'APPROVED') as approved,
        (select count(*)::int from organizations where status = 'SUSPENDED') as suspended,
        (select count(*)::int from students where archived = false) as students,
        (select count(*)::int from programs where deleted_at is null) as programs,
        (select count(*)::int from certificates) as certificates,
        (select count(*)::int from certificates where created_at >= date_trunc('month', now())) as month_certs,
        (select count(*)::int from verification_events) as verifications,
        (select count(*)::int from email_deliveries where status in ('SENT','DELIVERED')) as emails,
        (select count(*)::int from subscriptions s join subscription_plans p on p.id = s.plan_id where p.price_inr > 0 and s.status = 'ACTIVE') as paid,
        (select count(*)::int from subscriptions s join subscription_plans p on p.id = s.plan_id where p.price_inr = 0 and s.status = 'ACTIVE') as free,
        (select count(*)::int from payment_requests where status in ('PENDING','SUBMITTED')) as pending_pay,
        (select coalesce(sum(amount_inr),0)::int from payments where status = 'SUCCESS') as revenue
    `;
    return row[0]!;
  });

export const adminListOrganizations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { query?: string; status?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const q = `%${(data.query ?? "").trim().toLowerCase()}%`;
    const status = data.status || null;
    return sql.query<{
      id: string;
      name: string;
      official_email: string | null;
      status: string;
      city: string | null;
      created_at: string;
      plan_name: string | null;
    }>(
      `select o.id, o.name, o.official_email, o.status, o.city, o.created_at::text, p.name as plan_name
       from organizations o
       left join lateral (
         select s.plan_id from subscriptions s where s.organization_id = o.id order by s.created_at desc limit 1
       ) s on true
       left join subscription_plans p on p.id = s.plan_id
       where o.deleted_at is null
         and ($1::text is null or o.status = $1)
         and ($2 = '%%' or lower(o.name) like $2 or lower(coalesce(o.official_email,'')) like $2)
       order by o.created_at desc
       limit 100`,
      [status, q],
    );
  });

export const adminGetOrganization = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await requireAdmin(context.userId);
    const orgs = await sql`select * from organizations where id = ${id}`;
    const approvals = await sql`
      select * from organization_approvals where organization_id = ${id} order by created_at desc
    `;
    const usage = await sql`select * from usage_counters where organization_id = ${id} order by period desc limit 6`;

    const organization = orgs[0]
      ? (Object.fromEntries(
          Object.entries(orgs[0]).map(([key, value]) => [
            key,
            value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
              ? value
              : String(value),
          ]),
        ) as Record<string, string | number | boolean | null>)
      : null;

    return {
      organization,
      approvals: approvals.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
              ? value
              : String(value),
          ]),
        ) as Record<string, string | number | boolean | null>,
      ),
      usage: usage.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
              ? value
              : String(value),
          ]),
        ) as Record<string, string | number | boolean | null>,
      ),
    };
  });

export const adminReviewOrganization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "APPROVE" | "REJECT" | "SUSPEND" | "ACTIVATE" | "REQUEST_CHANGES"; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const status =
      data.action === "APPROVE" || data.action === "ACTIVATE"
        ? "APPROVED"
        : data.action === "REJECT"
          ? "REJECTED"
          : data.action === "SUSPEND"
            ? "SUSPENDED"
            : "CHANGES_REQUESTED";
    await sql`
      update organizations set status = ${status}, rejection_reason = ${data.note || null}, updated_at = now()
      where id = ${data.id}
    `;
    await sql`
      insert into organization_approvals (id, organization_id, actor_user_id, action, note)
      values (${createId("apr")}, ${data.id}, ${context.userId}, ${data.action}, ${data.note || null})
    `;
    const members = await sql<{ user_id: string }>`select user_id from organization_members where organization_id = ${data.id}`;
    for (const m of members) {
      await notify(sql, {
        userId: m.user_id,
        organizationId: data.id,
        title: `Organization ${status.toLowerCase().replace("_", " ")}`,
        body: data.note || `Your organization is now ${status}.`,
        href: "/app",
      });
    }
    await writeAudit(sql, {
      organizationId: data.id,
      userId: context.userId,
      action: `organization.${data.action.toLowerCase()}`,
      resource: "organization",
      resourceId: data.id,
      metadata: { note: data.note },
    });
    return { ok: true };
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<{
      id: string;
      organization_id: string;
      org_name: string;
      plan_id: string;
      order_ref: string;
      amount_inr: number;
      status: string;
      utr: string | null;
      created_at: string;
    }>`
      select r.id, r.organization_id, o.name as org_name, r.plan_id, r.order_ref, r.amount_inr, r.status, r.utr, r.created_at::text
      from payment_requests r
      join organizations o on o.id = r.organization_id
      order by r.created_at desc
      limit 100
    `;
  });

export const adminReviewPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "APPROVE" | "REJECT" | "CLARIFICATION"; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const rows = await sql<{
      id: string;
      organization_id: string;
      plan_id: string;
      amount_inr: number;
    }>`select id, organization_id, plan_id, amount_inr from payment_requests where id = ${data.id}`;
    const req = rows[0];
    if (!req) throw new Error("Payment not found");
    if (data.action === "APPROVE") {
      await sql`
        update payment_requests set status = ${"SUCCESS"}, admin_note = ${data.note || null}, reviewed_by = ${context.userId}, updated_at = now()
        where id = ${req.id}
      `;
      await sql`
        insert into payments (id, organization_id, payment_request_id, amount_inr, method, status)
        values (${createId("pmt")}, ${req.organization_id}, ${req.id}, ${req.amount_inr}, ${"QR_MANUAL"}, ${"SUCCESS"})
      `;
      await sql`
        insert into subscriptions (id, organization_id, plan_id, status, period_start, period_end)
        values (${createId("sub")}, ${req.organization_id}, ${req.plan_id}, ${"ACTIVE"}, now(), now() + interval '1 month')
      `;
    } else {
      const status = data.action === "REJECT" ? "REJECTED" : "CLARIFICATION";
      await sql`
        update payment_requests set status = ${status}, admin_note = ${data.note || null}, reviewed_by = ${context.userId}, updated_at = now()
        where id = ${req.id}
      `;
    }
    await writeAudit(sql, {
      organizationId: req.organization_id,
      userId: context.userId,
      action: `payment.${data.action.toLowerCase()}`,
      resource: "payment_request",
      resourceId: req.id,
    });
    return { ok: true };
  });

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    const rows = await sql<Parameters<typeof parseLimits>[0] & {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      price_inr: number;
      is_public: boolean;
    }>`
      select * from subscription_plans order by sort_order
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      priceInr: r.price_inr,
      isPublic: r.is_public,
      limits: parseLimits(r),
    }));
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id: string;
      name: string;
      description?: string;
      priceInr: number;
      monthlyCertificates: number;
      monthlyEmails: number;
      maxStudents: number;
      maxPrograms: number;
      maxTemplates: number;
      maxTeamMembers: number;
      storageMb: number;
      advancedAnalytics: boolean;
      aiGeneration: boolean;
      customBranding: boolean;
      bulkOperations: boolean;
      apiAccess: boolean;
      prioritySupport: boolean;
      whiteLabel: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await sql`
      update subscription_plans set
        name = ${data.name},
        description = ${data.description || null},
        price_inr = ${data.priceInr},
        monthly_certificates = ${data.monthlyCertificates},
        monthly_emails = ${data.monthlyEmails},
        max_students = ${data.maxStudents},
        max_programs = ${data.maxPrograms},
        max_templates = ${data.maxTemplates},
        max_team_members = ${data.maxTeamMembers},
        storage_mb = ${data.storageMb},
        advanced_analytics = ${data.advancedAnalytics},
        ai_generation = ${data.aiGeneration},
        custom_branding = ${data.customBranding},
        bulk_operations = ${data.bulkOperations},
        api_access = ${data.apiAccess},
        priority_support = ${data.prioritySupport},
        white_label = ${data.whiteLabel},
        updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true };
  });

export const adminListFlags = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<{ key: string; enabled: boolean; description: string | null }>`
      select key, enabled, description from feature_flags order by key
    `;
  });

export const adminToggleFlag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { key: string; enabled: boolean }) => input)
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await sql`update feature_flags set enabled = ${data.enabled} where key = ${data.key}`;
    return { ok: true };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<{
      id: string;
      action: string;
      resource: string | null;
      organization_id: string | null;
      user_id: string | null;
      created_at: string;
    }>`
      select id, action, resource, organization_id, user_id, created_at::text
      from audit_logs order by created_at desc limit 150
    `;
  });

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<{
      id: string;
      subject: string;
      status: string;
      priority: string;
      organization_id: string | null;
      created_at: string;
    }>`
      select id, subject, status, priority, organization_id, created_at::text
      from support_tickets order by created_at desc limit 100
    `;
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; message: string; status: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await sql`
      insert into support_messages (id, ticket_id, user_id, body, is_admin)
      values (${createId("msg")}, ${data.id}, ${context.userId}, ${data.message}, ${true})
    `;
    await sql`update support_tickets set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    return { ok: true };
  });

export const adminSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    const rows = await sql<{ key: string; value: string }>`select key, value from system_settings`;
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Record<string, string>) => input)
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    for (const [key, value] of Object.entries(data)) {
      await sql`
        insert into system_settings (key, value) values (${key}, ${value})
        on conflict (key) do update set value = excluded.value
      `;
    }
    return { ok: true };
  });
