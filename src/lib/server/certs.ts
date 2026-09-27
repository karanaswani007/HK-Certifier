import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { blankLayout } from "@/lib/certifier/default-templates";
import { createId, generateCertificateId, programCodeFromName, randomToken } from "@/lib/certifier/ids";
import { assertWithinLimit } from "@/lib/certifier/limits";
import { qrSvg } from "@/lib/certifier/qr";
import type { CertLayout } from "@/lib/certifier/types";
import { applyLayoutVariables } from "@/lib/certifier/variables";
import {
  bumpUsage,
  getMembership,
  getPlanLimits,
  getUsage,
  notify,
  parseJson,
  requireApprovedOrg,
  writeAudit,
} from "./helpers";
import type { Sql } from "@/lib/db";

async function org(userId: string, write = false) {
  const sql = await getSql();
  const membership = await getMembership(sql, userId);
  if (!membership) throw new Error("No organization");
  if (write) await requireApprovedOrg(membership, true);
  return { sql, membership };
}

function originFrom(input?: string) {
  if (input && /^https?:\/\//.test(input)) return input.replace(/\/$/, "");
  return "";
}

async function issueOne(
  sql: Sql,
  opts: {
    orgId: string;
    orgName: string;
    program: {
      id: string;
      name: string;
      type: string;
      start_date: string | null;
      end_date: string | null;
      duration: string | null;
      mentor_name: string | null;
      location: string | null;
      certificate_title: string | null;
    };
    student: {
      id: string;
      full_name: string;
      email: string;
      student_code: string | null;
      college: string | null;
      course: string | null;
      branch: string | null;
      batch: string | null;
      registration_number: string | null;
      custom_fields: string;
    };
    template: { id: string; layout_json: string };
    origin: string;
  },
) {
  const publicId = generateCertificateId(programCodeFromName(opts.program.name));
  const verifyUrl = `${opts.origin || "https://cert.hksofttech.in"}/verify/${publicId}`;
  const custom = parseJson<Record<string, string>>(opts.student.custom_fields, {});
  const values: Record<string, string> = {
    student_name: opts.student.full_name,
    student_id: opts.student.student_code ?? "",
    student_email: opts.student.email,
    college: opts.student.college ?? "",
    course_name: opts.student.course ?? "",
    branch: opts.student.branch ?? "",
    batch: opts.student.batch ?? "",
    registration_number: opts.student.registration_number ?? "",
    program_name: opts.program.name,
    program_type: opts.program.type,
    organization_name: opts.orgName,
    start_date: opts.program.start_date ?? "",
    end_date: opts.program.end_date ?? "",
    duration: opts.program.duration ?? "",
    issue_date: new Date().toISOString().slice(0, 10),
    certificate_id: publicId,
    verification_url: verifyUrl,
    mentor_name: opts.program.mentor_name ?? "",
    certificate_title: opts.program.certificate_title ?? opts.program.name,
    location: opts.program.location ?? "",
    ...custom,
  };
  const layout = parseJson<CertLayout>(opts.template.layout_json, blankLayout());
  const resolved = applyLayoutVariables(layout, values) as CertLayout;
  const qr = await qrSvg(verifyUrl, 256);
  const id = createId("crt");
  await sql`
    insert into certificates (
      id, organization_id, program_id, student_id, template_id, public_id, verification_token,
      title, student_name, student_email, organization_name, program_name, duration, issue_date,
      status, layout_json, qr_svg
    ) values (
      ${id}, ${opts.orgId}, ${opts.program.id}, ${opts.student.id}, ${opts.template.id},
      ${publicId}, ${randomToken(16)}, ${values.certificate_title}, ${opts.student.full_name},
      ${opts.student.email}, ${opts.orgName}, ${opts.program.name}, ${opts.program.duration},
      ${values.issue_date}, ${"VALID"}, ${JSON.stringify(resolved)}, ${qr}
    )
  `;
  return { id, publicId, email: opts.student.email, name: opts.student.full_name };
}

export const listCertificates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { query?: string; status?: string; programId?: string; page?: number } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId);
    const q = `%${(data.query ?? "").trim().toLowerCase()}%`;
    const status = data.status || null;
    const programId = data.programId || null;
    const page = Math.max(0, data.page ?? 0);
    const rows = await sql.query<{
      id: string;
      public_id: string;
      student_name: string;
      student_email: string | null;
      program_name: string | null;
      status: string;
      issue_date: string | null;
      download_count: number;
      view_count: number;
      created_at: string;
    }>(
      `select id, public_id, student_name, student_email, program_name, status, issue_date::text,
              download_count, view_count, created_at::text
       from certificates
       where organization_id = $1
         and ($2::text is null or status = $2)
         and ($3::text is null or program_id = $3)
         and ($4 = '%%' or lower(student_name) like $4 or lower(public_id) like $4
              or lower(coalesce(program_name,'')) like $4)
       order by created_at desc
       limit 50 offset $5`,
      [membership.orgId, status, programId, q, page * 50],
    );
    const count = await sql.query<{ n: number }>(
      `select count(*)::int as n from certificates
       where organization_id = $1
         and ($2::text is null or status = $2)
         and ($3::text is null or program_id = $3)
         and ($4 = '%%' or lower(student_name) like $4 or lower(public_id) like $4
              or lower(coalesce(program_name,'')) like $4)`,
      [membership.orgId, status, programId, q],
    );
    return { rows, total: count[0]?.n ?? 0, page };
  });

export const getCertificate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId);
    const rows = await sql<{
      id: string;
      public_id: string;
      student_name: string;
      student_email: string | null;
      program_name: string | null;
      organization_name: string | null;
      title: string | null;
      duration: string | null;
      issue_date: string | null;
      status: string;
      layout_json: string;
      qr_svg: string | null;
      download_count: number;
      view_count: number;
      revoked_reason: string | null;
    }>`
      select id, public_id, student_name, student_email, program_name, organization_name, title, duration,
             issue_date::text, status, layout_json, qr_svg, download_count, view_count, revoked_reason
      from certificates where id = ${id} and organization_id = ${membership.orgId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Certificate not found");
    return { ...row, layout: parseJson<CertLayout>(row.layout_json, blankLayout()) };
  });

export const createGenerationJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { programId: string; templateId: string; studentIds: string[]; origin?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const limits = await getPlanLimits(sql, membership.orgId);
    if (data.studentIds.length > 1 && !limits.bulkOperations) {
      throw new Error("Bulk generation is not available on your current plan.");
    }
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(
      usage.certificates,
      limits.monthlyCertificates,
      data.studentIds.length,
      "Monthly certificates",
    );
    if (!check.ok) throw new Error(check.message);
    const jobId = createId("job");
    await sql`
      insert into certificate_generation_jobs (
        id, organization_id, program_id, template_id, status, total_count, created_by
      ) values (
        ${jobId}, ${membership.orgId}, ${data.programId}, ${data.templateId}, ${"QUEUED"},
        ${data.studentIds.length}, ${context.userId}
      )
    `;
    for (const sid of data.studentIds) {
      await sql`
        insert into certificate_generation_items (id, job_id, student_id, status)
        values (${createId("gitem")}, ${jobId}, ${sid}, ${"QUEUED"})
      `;
    }
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "certificates.job.created",
      resource: "generation_job",
      resourceId: jobId,
      metadata: { count: data.studentIds.length },
    });
    return { jobId, origin: originFrom(data.origin) };
  });

export const processGenerationJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { jobId: string; origin?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const jobs = await sql<{
      id: string;
      program_id: string | null;
      template_id: string | null;
      total_count: number;
      completed_count: number;
      failed_count: number;
      status: string;
    }>`
      select id, program_id, template_id, total_count, completed_count, failed_count, status
      from certificate_generation_jobs
      where id = ${data.jobId} and organization_id = ${membership.orgId}
    `;
    const job = jobs[0];
    if (!job) throw new Error("Job not found");
    await sql`update certificate_generation_jobs set status = ${"PROCESSING"}, updated_at = now() where id = ${job.id}`;

    const programRows = await sql<{
      id: string;
      name: string;
      type: string;
      start_date: string | null;
      end_date: string | null;
      duration: string | null;
      mentor_name: string | null;
      location: string | null;
      certificate_title: string | null;
    }>`
      select id, name, type, start_date::text, end_date::text, duration, mentor_name, location, certificate_title
      from programs where id = ${job.program_id} and organization_id = ${membership.orgId}
    `;
    const templateRows = await sql<{ id: string; layout_json: string }>`
      select id, layout_json from certificate_templates
      where id = ${job.template_id} and organization_id = ${membership.orgId}
    `;
    const program = programRows[0];
    const template = templateRows[0];
    if (!program || !template) throw new Error("Program or template missing");

    const items = await sql<{ id: string; student_id: string | null }>`
      select id, student_id from certificate_generation_items
      where job_id = ${job.id} and status = 'QUEUED'
      order by created_at
      limit 25
    `;
    const origin = originFrom(data.origin);
    let completed = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const students = await sql<{
          id: string;
          full_name: string;
          email: string;
          student_code: string | null;
          college: string | null;
          course: string | null;
          branch: string | null;
          batch: string | null;
          registration_number: string | null;
          custom_fields: string;
        }>`
          select id, full_name, email, student_code, college, course, branch, batch, registration_number, custom_fields
          from students where id = ${item.student_id} and organization_id = ${membership.orgId}
        `;
        const student = students[0];
        if (!student) throw new Error("Student missing");
        const issued = await issueOne(sql, {
          orgId: membership.orgId,
          orgName: membership.orgName,
          program,
          student,
          template,
          origin,
        });
        await bumpUsage(sql, membership.orgId, "certificates", 1);
        await sql`
          update certificate_generation_items
          set status = ${"COMPLETED"}, certificate_id = ${issued.id}
          where id = ${item.id}
        `;
        completed += 1;
      } catch (err) {
        failed += 1;
        await sql`
          update certificate_generation_items
          set status = ${"FAILED"}, error = ${err instanceof Error ? err.message : "Failed"}
          where id = ${item.id}
        `;
      }
    }

    const next = await sql<{
      total_count: number;
      done: number;
      failed_count: number;
      remaining: number;
    }>`
      select
        j.total_count,
        (select count(*)::int from certificate_generation_items i where i.job_id = j.id and i.status = 'COMPLETED') as done,
        (select count(*)::int from certificate_generation_items i where i.job_id = j.id and i.status = 'FAILED') as failed_count,
        (select count(*)::int from certificate_generation_items i where i.job_id = j.id and i.status = 'QUEUED') as remaining
      from certificate_generation_jobs j where j.id = ${job.id}
    `;
    const snap = next[0]!;
    const status = snap.remaining > 0 ? "PROCESSING" : snap.failed_count && !snap.done ? "FAILED" : "COMPLETED";
    await sql`
      update certificate_generation_jobs set
        completed_count = ${snap.done}, failed_count = ${snap.failed_count}, status = ${status}, updated_at = now()
      where id = ${job.id}
    `;
    if (status === "COMPLETED") {
      await notify(sql, {
        userId: context.userId,
        organizationId: membership.orgId,
        title: "Certificate generation complete",
        body: `${snap.done} certificate${snap.done === 1 ? "" : "s"} generated.`,
        href: "/app/certificates",
      });
    }
    return {
      jobId: job.id,
      total: snap.total_count,
      completed: snap.done,
      failed: snap.failed_count,
      remaining: snap.remaining,
      status,
      batchCompleted: completed,
      batchFailed: failed,
    };
  });

export const getGenerationJob = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((jobId: string) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const { sql, membership } = await org(context.userId);
    const rows = await sql<{
      id: string;
      status: string;
      total_count: number;
      completed_count: number;
      failed_count: number;
    }>`
      select id, status, total_count, completed_count, failed_count
      from certificate_generation_jobs
      where id = ${jobId} and organization_id = ${membership.orgId}
    `;
    return rows[0] ?? null;
  });

export const revokeCertificate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; reason?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    await sql`
      update certificates set status = ${"REVOKED"}, revoked_at = now(), revoked_reason = ${data.reason || null}, updated_at = now()
      where id = ${data.id} and organization_id = ${membership.orgId}
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "certificate.revoked",
      resource: "certificate",
      resourceId: data.id,
      metadata: { reason: data.reason },
    });
    return { ok: true };
  });

export const reissueCertificate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; origin?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.certificates, limits.monthlyCertificates, 1, "Monthly certificates");
    if (!check.ok) throw new Error(check.message);
    const existing = await sql<{
      student_id: string | null;
      program_id: string | null;
      template_id: string | null;
    }>`
      select student_id, program_id, template_id from certificates
      where id = ${data.id} and organization_id = ${membership.orgId}
    `;
    const src = existing[0];
    if (!src?.student_id || !src.program_id || !src.template_id) throw new Error("Cannot reissue this certificate.");
    const job = await createGenerationJob({
      data: {
        programId: src.program_id,
        templateId: src.template_id,
        studentIds: [src.student_id],
        origin: data.origin,
      },
    });
    const processed = await processGenerationJob({ data: { jobId: job.jobId, origin: data.origin } });
    await sql`
      update certificates set status = ${"REISSUED"}, updated_at = now()
      where id = ${data.id} and organization_id = ${membership.orgId}
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "certificate.reissued",
      resource: "certificate",
      resourceId: data.id,
    });
    return processed;
  });

export const recordDownload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId);
    await sql`
      update certificates set download_count = download_count + 1
      where id = ${id} and organization_id = ${membership.orgId}
    `;
    return { ok: true };
  });

function emailHtml(input: {
  orgName: string;
  studentName: string;
  programName: string;
  publicId: string;
  verifyUrl: string;
}) {
  return `Hello ${input.studentName},

Your certificate for ${input.programName} is ready.

Certificate ID: ${input.publicId}
Issued by: ${input.orgName}

Download / verify: ${input.verifyUrl}

This message was sent by HK Certifier on behalf of ${input.orgName}.`;
}

export const queueCertificateEmails = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { certificateIds: string[]; origin?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.emails, limits.monthlyEmails, data.certificateIds.length, "Monthly emails");
    if (!check.ok) throw new Error(check.message);
    const jobId = createId("emjob");
    await sql`
      insert into email_jobs (id, organization_id, status, total_count, created_by)
      values (${jobId}, ${membership.orgId}, ${"QUEUED"}, ${data.certificateIds.length}, ${context.userId})
    `;
    const origin = originFrom(data.origin);
    let queued = 0;
    for (const cid of data.certificateIds) {
      const certs = await sql<{
        id: string;
        public_id: string;
        student_name: string;
        student_email: string | null;
        program_name: string | null;
        organization_name: string | null;
      }>`
        select id, public_id, student_name, student_email, program_name, organization_name
        from certificates where id = ${cid} and organization_id = ${membership.orgId}
      `;
      const c = certs[0];
      if (!c?.student_email) continue;
      const verifyUrl = `${origin || "https://cert.hksofttech.in"}/verify/${c.public_id}`;
      const body = emailHtml({
        orgName: c.organization_name || membership.orgName,
        studentName: c.student_name,
        programName: c.program_name || "the program",
        publicId: c.public_id,
        verifyUrl,
      });
      await sql`
        insert into email_deliveries (
          id, organization_id, job_id, certificate_id, to_email, subject, body_text, status, provider, sent_at
        ) values (
          ${createId("em")}, ${membership.orgId}, ${jobId}, ${c.id}, ${c.student_email},
          ${`Your certificate · ${c.public_id}`}, ${body}, ${"SENT"}, ${"log"}, now()
        )
      `;
      await bumpUsage(sql, membership.orgId, "emails", 1);
      queued += 1;
    }
    await sql`
      update email_jobs set status = ${"COMPLETED"}, completed_count = ${queued}, updated_at = now()
      where id = ${jobId}
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "emails.queued",
      resource: "email_job",
      resourceId: jobId,
      metadata: { queued },
    });
    return { jobId, queued };
  });

export const listEmails = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId);
    return sql<{
      id: string;
      to_email: string;
      subject: string;
      status: string;
      error: string | null;
      sent_at: string | null;
      created_at: string;
      certificate_id: string | null;
    }>`
      select id, to_email, subject, status, error, sent_at::text, created_at::text, certificate_id
      from email_deliveries where organization_id = ${membership.orgId}
      order by created_at desc limit 100
    `;
  });

export const retryFailedEmails = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId, true);
    await sql`
      update email_deliveries set status = ${"SENT"}, error = null, sent_at = now()
      where organization_id = ${membership.orgId} and status = 'FAILED'
    `;
    return { ok: true };
  });

export const orgAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { days?: number } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId);
    const days = data.days ?? 30;
    const totals = await sql<{
      certificates: number;
      valid: number;
      revoked: number;
      emails: number;
      students: number;
      programs: number;
      views: number;
      downloads: number;
    }>`
      select
        (select count(*)::int from certificates where organization_id = ${membership.orgId}) as certificates,
        (select count(*)::int from certificates where organization_id = ${membership.orgId} and status = 'VALID') as valid,
        (select count(*)::int from certificates where organization_id = ${membership.orgId} and status = 'REVOKED') as revoked,
        (select count(*)::int from email_deliveries where organization_id = ${membership.orgId} and status in ('SENT','DELIVERED')) as emails,
        (select count(*)::int from students where organization_id = ${membership.orgId} and archived = false) as students,
        (select count(*)::int from programs where organization_id = ${membership.orgId} and deleted_at is null) as programs,
        (select coalesce(sum(view_count),0)::int from certificates where organization_id = ${membership.orgId}) as views,
        (select coalesce(sum(download_count),0)::int from certificates where organization_id = ${membership.orgId}) as downloads
    `;
    const series = await sql.query<{ day: string; n: number }>(
      `select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as n
       from certificates
       where organization_id = $1 and created_at > now() - ($2 || ' days')::interval
       group by 1 order by 1`,
      [membership.orgId, String(days)],
    );
    const verifications = await sql.query<{ day: string; n: number }>(
      `select to_char(v.created_at, 'YYYY-MM-DD') as day, count(*)::int as n
       from verification_events v
       join certificates c on c.public_id = v.public_id
       where c.organization_id = $1 and v.created_at > now() - ($2 || ' days')::interval
       group by 1 order by 1`,
      [membership.orgId, String(days)],
    );
    return { totals: totals[0]!, series, verifications };
  });

export const listVerificationLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId);
    return sql.query<{
      id: string;
      public_id: string | null;
      result: string;
      created_at: string;
    }>(
      `select v.id, v.public_id, v.result, v.created_at::text
       from verification_events v
       join certificates c on c.public_id = v.public_id
       where c.organization_id = $1
       order by v.created_at desc limit 100`,
      [membership.orgId],
    );
  });
