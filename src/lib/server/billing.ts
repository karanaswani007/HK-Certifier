import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { createId } from "@/lib/certifier/ids";
import { parseLimits } from "@/lib/certifier/limits";
import { getMembership, writeAudit } from "./helpers";

export const getBilling = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    const plans = await sql<Parameters<typeof parseLimits>[0] & {
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
      from subscription_plans where is_public = true order by sort_order
    `;
    const sub = await sql<{
      plan_id: string;
      status: string;
      period_start: string | null;
      period_end: string | null;
      name: string;
    }>`
      select s.plan_id, s.status, s.period_start::text, s.period_end::text, p.name
      from subscriptions s join subscription_plans p on p.id = s.plan_id
      where s.organization_id = ${membership.orgId}
      order by s.created_at desc limit 1
    `;
    const settings = await sql<{ key: string; value: string }>`
      select key, value from system_settings
      where key in ('payment_upi_id','payment_instructions','payment_account_name')
    `;
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const requests = await sql<{
      id: string;
      order_ref: string;
      amount_inr: number;
      status: string;
      plan_id: string;
      utr: string | null;
      created_at: string;
    }>`
      select id, order_ref, amount_inr, status, plan_id, utr, created_at::text
      from payment_requests where organization_id = ${membership.orgId}
      order by created_at desc limit 20
    `;
    return {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        priceInr: p.price_inr,
        limits: parseLimits(p),
      })),
      subscription: sub[0] ?? null,
      payment: {
        upiId: map.payment_upi_id ?? "hksofttech@upi",
        instructions: map.payment_instructions ?? "",
        accountName: map.payment_account_name ?? "HK SoftTech",
      },
      requests,
    };
  });

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((planId: string) => planId)
  .handler(async ({ context, data: planId }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    const plan = await sql<{ id: string; price_inr: number; name: string }>`
      select id, price_inr, name from subscription_plans where id = ${planId}
    `;
    if (!plan[0] || plan[0].price_inr <= 0) throw new Error("Select a paid plan.");
    const orderRef = `HKC-${Date.now().toString(36).toUpperCase()}`;
    const id = createId("pay");
    await sql`
      insert into payment_requests (id, organization_id, plan_id, order_ref, amount_inr, status, created_by)
      values (${id}, ${membership.orgId}, ${planId}, ${orderRef}, ${plan[0].price_inr}, ${"PENDING"}, ${context.userId})
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "payment.created",
      resource: "payment_request",
      resourceId: id,
    });
    return { id, orderRef, amount: plan[0].price_inr, planName: plan[0].name };
  });

export const submitPaymentProof = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; utr: string; paymentDate: string; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    await sql`
      update payment_requests set
        utr = ${data.utr}, payment_date = ${data.paymentDate}, note = ${data.note || null},
        status = ${"SUBMITTED"}, updated_at = now()
      where id = ${data.id} and organization_id = ${membership.orgId}
    `;
    return { ok: true };
  });

export const listSupportTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) return [];
    return sql<{
      id: string;
      subject: string;
      category: string;
      priority: string;
      status: string;
      created_at: string;
    }>`
      select id, subject, category, priority, status, created_at::text
      from support_tickets where organization_id = ${membership.orgId}
      order by created_at desc
    `;
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject: string; category: string; priority: string; message: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    const id = createId("tkt");
    await sql`
      insert into support_tickets (id, organization_id, user_id, subject, category, priority)
      values (${id}, ${membership.orgId}, ${context.userId}, ${data.subject}, ${data.category}, ${data.priority})
    `;
    await sql`
      insert into support_messages (id, ticket_id, user_id, body, is_admin)
      values (${createId("msg")}, ${id}, ${context.userId}, ${data.message}, ${false})
    `;
    return { id };
  });

export const getSupportTicket = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    const tickets = await sql<{
      id: string;
      subject: string;
      category: string;
      priority: string;
      status: string;
    }>`
      select id, subject, category, priority, status
      from support_tickets where id = ${id} and organization_id = ${membership.orgId}
    `;
    const ticket = tickets[0];
    if (!ticket) throw new Error("Ticket not found");
    const messages = await sql<{
      id: string;
      body: string;
      is_admin: boolean;
      created_at: string;
      user_id: string;
    }>`
      select id, body, is_admin, created_at::text, user_id
      from support_messages where ticket_id = ${id} order by created_at
    `;
    return { ticket, messages };
  });

export const replySupportTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; message: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    await sql`
      insert into support_messages (id, ticket_id, user_id, body, is_admin)
      values (${createId("msg")}, ${data.id}, ${context.userId}, ${data.message}, ${false})
    `;
    await sql`update support_tickets set status = ${"WAITING"}, updated_at = now() where id = ${data.id} and organization_id = ${membership.orgId}`;
    return { ok: true };
  });
