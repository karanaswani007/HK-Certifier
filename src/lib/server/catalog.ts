import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { blankLayout, DEFAULT_TEMPLATE_DEFS } from "@/lib/certifier/default-templates";
import { createId } from "@/lib/certifier/ids";
import { assertWithinLimit } from "@/lib/certifier/limits";
import {
  parseCsv,
  suggestMapping,
  validateStudentRow,
  type StudentRecord,
} from "@/lib/certifier/csv";
import type { CertLayout } from "@/lib/certifier/types";
import {
  canAdmin,
  getMembership,
  getPlanLimits,
  getUsage,
  parseJson,
  requireApprovedOrg,
  writeAudit,
} from "./helpers";

async function org(userId: string, write = false) {
  const sql = await getSql();
  const membership = await getMembership(sql, userId);
  if (!membership) throw new Error("No organization");
  if (write) await requireApprovedOrg(membership, true);
  return { sql, membership };
}

export const listPrograms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId);
    return sql<{
      id: string;
      name: string;
      type: string;
      description: string | null;
      start_date: string | null;
      end_date: string | null;
      duration: string | null;
      mentor_name: string | null;
      location: string | null;
      certificate_title: string | null;
      skills: string | null;
      status: string;
      student_count: number;
    }>`
      select p.*, (select count(*)::int from students s where s.program_id = p.id and s.archived = false) as student_count
      from programs p
      where p.organization_id = ${membership.orgId} and p.deleted_at is null
      order by p.created_at desc
    `;
  });

const programSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(160),
  type: z.string().min(2).max(60),
  description: z.string().max(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  duration: z.string().max(80).optional(),
  mentorName: z.string().max(80).optional(),
  location: z.string().max(120).optional(),
  certificateTitle: z.string().max(160).optional(),
  skills: z.string().max(400).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
});

export const saveProgram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: z.infer<typeof programSchema>) => programSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    if (data.id) {
      await sql`
        update programs set
          name = ${data.name}, type = ${data.type}, description = ${data.description || null},
          start_date = ${data.startDate || null}, end_date = ${data.endDate || null},
          duration = ${data.duration || null}, mentor_name = ${data.mentorName || null},
          location = ${data.location || null}, certificate_title = ${data.certificateTitle || null},
          skills = ${data.skills || null}, status = ${data.status}, updated_at = now()
        where id = ${data.id} and organization_id = ${membership.orgId}
      `;
      await writeAudit(sql, {
        organizationId: membership.orgId,
        userId: context.userId,
        action: "program.updated",
        resource: "program",
        resourceId: data.id,
      });
      return { id: data.id };
    }
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.programs, limits.maxPrograms, 1, "Programs");
    if (!check.ok) throw new Error(check.message);
    const id = createId("prg");
    await sql`
      insert into programs (
        id, organization_id, name, type, description, start_date, end_date, duration,
        mentor_name, location, certificate_title, skills, status
      ) values (
        ${id}, ${membership.orgId}, ${data.name}, ${data.type}, ${data.description || null},
        ${data.startDate || null}, ${data.endDate || null}, ${data.duration || null},
        ${data.mentorName || null}, ${data.location || null}, ${data.certificateTitle || null},
        ${data.skills || null}, ${data.status}
      )
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "program.created",
      resource: "program",
      resourceId: id,
    });
    return { id };
  });

export const deleteProgram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId, true);
    await sql`
      update programs set deleted_at = now() where id = ${id} and organization_id = ${membership.orgId}
    `;
    return { ok: true };
  });

export const listStudents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { query?: string; programId?: string; page?: number } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId);
    const page = Math.max(0, data.page ?? 0);
    const q = `%${(data.query ?? "").trim().toLowerCase()}%`;
    const programId = data.programId || null;
    const rows = await sql.query<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      student_code: string | null;
      college: string | null;
      course: string | null;
      branch: string | null;
      batch: string | null;
      registration_number: string | null;
      program_id: string | null;
      program_name: string | null;
      custom_fields: string;
      created_at: string;
    }>(
      `select s.id, s.full_name, s.email, s.phone, s.student_code, s.college, s.course, s.branch, s.batch,
              s.registration_number, s.program_id, p.name as program_name, s.custom_fields, s.created_at::text
       from students s
       left join programs p on p.id = s.program_id
       where s.organization_id = $1 and s.archived = false
         and ($2::text is null or s.program_id = $2)
         and ($3 = '%%' or lower(s.full_name) like $3 or lower(s.email) like $3
              or lower(coalesce(s.student_code,'')) like $3 or lower(coalesce(s.college,'')) like $3)
       order by s.created_at desc
       limit 50 offset $4`,
      [membership.orgId, programId, q, page * 50],
    );
    const count = await sql.query<{ n: number }>(
      `select count(*)::int as n from students s
       where s.organization_id = $1 and s.archived = false
         and ($2::text is null or s.program_id = $2)
         and ($3 = '%%' or lower(s.full_name) like $3 or lower(s.email) like $3
              or lower(coalesce(s.student_code,'')) like $3 or lower(coalesce(s.college,'')) like $3)`,
      [membership.orgId, programId, q],
    );
    return { rows, total: count[0]?.n ?? 0, page };
  });

const studentSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  studentCode: z.string().max(60).optional(),
  college: z.string().max(120).optional(),
  course: z.string().max(80).optional(),
  branch: z.string().max(80).optional(),
  batch: z.string().max(40).optional(),
  registrationNumber: z.string().max(80).optional(),
  programId: z.string().optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

export const saveStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: z.infer<typeof studentSchema>) => studentSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const custom = JSON.stringify(data.custom ?? {});
    if (data.id) {
      await sql`
        update students set
          full_name = ${data.fullName}, email = ${data.email.toLowerCase()}, phone = ${data.phone || null},
          student_code = ${data.studentCode || null}, college = ${data.college || null},
          course = ${data.course || null}, branch = ${data.branch || null}, batch = ${data.batch || null},
          registration_number = ${data.registrationNumber || null}, program_id = ${data.programId || null},
          custom_fields = ${custom}, updated_at = now()
        where id = ${data.id} and organization_id = ${membership.orgId}
      `;
      return { id: data.id };
    }
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.students, limits.maxStudents, 1, "Students");
    if (!check.ok) throw new Error(check.message);
    const id = createId("stu");
    await sql`
      insert into students (
        id, organization_id, program_id, full_name, email, phone, student_code, college, course, branch, batch, registration_number, custom_fields
      ) values (
        ${id}, ${membership.orgId}, ${data.programId || null}, ${data.fullName}, ${data.email.toLowerCase()},
        ${data.phone || null}, ${data.studentCode || null}, ${data.college || null}, ${data.course || null},
        ${data.branch || null}, ${data.batch || null}, ${data.registrationNumber || null}, ${custom}
      )
    `;
    return { id };
  });

export const archiveStudents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((ids: string[]) => ids)
  .handler(async ({ context, data: ids }) => {
    const { sql, membership } = await org(context.userId, true);
    for (const id of ids) {
      await sql`update students set archived = true where id = ${id} and organization_id = ${membership.orgId}`;
    }
    return { ok: true };
  });

export const previewCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { csv: string; mapping?: Record<string, string> }) => input)
  .handler(async ({ context, data }) => {
    await org(context.userId, true);
    const parsed = parseCsv(data.csv);
    const mapping = data.mapping ?? suggestMapping(parsed.headers);
    const preview = parsed.rows.slice(0, 25).map((row, i) => {
      const result = validateStudentRow(row, mapping, i + 2);
      return { row, record: result.record ?? null, errors: result.errors };
    });
    return { headers: parsed.headers, mapping, total: parsed.rows.length, preview, parseErrors: parsed.errors };
  });

export const importCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { csv: string; mapping: Record<string, string>; programId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const parsed = parseCsv(data.csv);
    const records: StudentRecord[] = [];
    const errors: Array<{ row: number; message: string }> = [...parsed.errors];
    const seen = new Set<string>();
    parsed.rows.forEach((row, i) => {
      const result = validateStudentRow(row, data.mapping, i + 2);
      errors.push(...result.errors);
      if (result.record) {
        const key = result.record.email;
        if (seen.has(key)) errors.push({ row: i + 2, message: "Duplicate email in file" });
        else {
          seen.add(key);
          records.push(result.record);
        }
      }
    });
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.students, limits.maxStudents, records.length, "Students");
    if (!check.ok) throw new Error(check.message);

    let imported = 0;
    for (const rec of records) {
      const existing = await sql<{ id: string }>`
        select id from students where organization_id = ${membership.orgId} and email = ${rec.email} and archived = false
      `;
      if (existing[0]) {
        await sql`
          update students set
            full_name = ${rec.fullName}, phone = ${rec.phone || null}, student_code = ${rec.studentId || null},
            college = ${rec.college || null}, course = ${rec.course || null}, branch = ${rec.branch || null},
            batch = ${rec.batch || null}, registration_number = ${rec.registrationNumber || null},
            program_id = ${data.programId || null}, custom_fields = ${JSON.stringify(rec.custom)}, updated_at = now()
          where id = ${existing[0].id}
        `;
      } else {
        await sql`
          insert into students (
            id, organization_id, program_id, full_name, email, phone, student_code, college, course, branch, batch, registration_number, custom_fields
          ) values (
            ${createId("stu")}, ${membership.orgId}, ${data.programId || null}, ${rec.fullName}, ${rec.email},
            ${rec.phone || null}, ${rec.studentId || null}, ${rec.college || null}, ${rec.course || null},
            ${rec.branch || null}, ${rec.batch || null}, ${rec.registrationNumber || null}, ${JSON.stringify(rec.custom)}
          )
        `;
      }
      imported += 1;
    }
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "students.imported",
      resource: "student",
      metadata: { imported, errors: errors.length },
    });
    return { imported, errors };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId);
    const rows = await sql<{
      id: string;
      name: string;
      category: string | null;
      description: string | null;
      layout_json: string;
      is_default: boolean;
      updated_at: string;
    }>`
      select id, name, category, description, layout_json, is_default, updated_at::text
      from certificate_templates
      where organization_id = ${membership.orgId} and archived = false
      order by is_default desc, updated_at desc
    `;
    return rows.map((r) => ({
      ...r,
      layout: parseJson<CertLayout>(r.layout_json, blankLayout()),
    }));
  });

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId);
    const rows = await sql<{
      id: string;
      name: string;
      category: string | null;
      description: string | null;
      layout_json: string;
      is_default: boolean;
    }>`
      select id, name, category, description, layout_json, is_default
      from certificate_templates
      where id = ${id} and organization_id = ${membership.orgId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Template not found");
    return { ...row, layout: parseJson<CertLayout>(row.layout_json, blankLayout()) };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      name: string;
      category?: string;
      description?: string;
      layout: CertLayout;
      isDefault?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId, true);
    const layoutJson = JSON.stringify(data.layout);
    if (data.id) {
      await sql`
        update certificate_templates set
          name = ${data.name}, category = ${data.category || null}, description = ${data.description || null},
          layout_json = ${layoutJson}, is_default = ${Boolean(data.isDefault)}, updated_at = now()
        where id = ${data.id} and organization_id = ${membership.orgId}
      `;
      const versions = await sql<{ n: number }>`
        select coalesce(max(version), 0)::int as n from certificate_template_versions where template_id = ${data.id}
      `;
      await sql`
        insert into certificate_template_versions (id, template_id, version, layout_json, created_by)
        values (${createId("ver")}, ${data.id}, ${(versions[0]?.n ?? 0) + 1}, ${layoutJson}, ${context.userId})
      `;
      await writeAudit(sql, {
        organizationId: membership.orgId,
        userId: context.userId,
        action: "template.updated",
        resource: "template",
        resourceId: data.id,
      });
      return { id: data.id };
    }
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.templates, limits.maxTemplates, 1, "Templates");
    if (!check.ok) throw new Error(check.message);
    const id = createId("tpl");
    await sql`
      insert into certificate_templates (id, organization_id, name, category, description, layout_json, is_default)
      values (${id}, ${membership.orgId}, ${data.name}, ${data.category || null}, ${data.description || null}, ${layoutJson}, ${Boolean(data.isDefault)})
    `;
    await sql`
      insert into certificate_template_versions (id, template_id, version, layout_json, created_by)
      values (${createId("ver")}, ${id}, ${1}, ${layoutJson}, ${context.userId})
    `;
    return { id };
  });

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId, true);
    const rows = await sql<{ name: string; category: string | null; description: string | null; layout_json: string }>`
      select name, category, description, layout_json from certificate_templates
      where id = ${id} and organization_id = ${membership.orgId}
    `;
    const src = rows[0];
    if (!src) throw new Error("Template not found");
    const newId = createId("tpl");
    await sql`
      insert into certificate_templates (id, organization_id, name, category, description, layout_json)
      values (${newId}, ${membership.orgId}, ${`${src.name} copy`}, ${src.category}, ${src.description}, ${src.layout_json})
    `;
    return { id: newId };
  });

export const archiveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, membership } = await org(context.userId, true);
    await sql`
      update certificate_templates set archived = true where id = ${id} and organization_id = ${membership.orgId}
    `;
    return { ok: true };
  });

export const createBlankTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId, true);
    const id = createId("tpl");
    await sql`
      insert into certificate_templates (id, organization_id, name, category, description, layout_json)
      values (${id}, ${membership.orgId}, ${"Untitled template"}, ${"Custom"}, ${"Blank canvas"}, ${JSON.stringify(blankLayout())})
    `;
    return { id };
  });

export const libraryTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    return DEFAULT_TEMPLATE_DEFS.map((d) => ({
      key: d.key,
      name: d.name,
      category: d.category,
      description: d.description,
      layout: d.layout,
    }));
  });

export const addLibraryTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((key: string) => key)
  .handler(async ({ context, data: key }) => {
    const { sql, membership } = await org(context.userId, true);
    const def = DEFAULT_TEMPLATE_DEFS.find((d) => d.key === key);
    if (!def) throw new Error("Unknown library template");
    const id = createId("tpl");
    await sql`
      insert into certificate_templates (id, organization_id, name, category, description, layout_json)
      values (${id}, ${membership.orgId}, ${def.name}, ${def.category}, ${def.description}, ${JSON.stringify(def.layout)})
    `;
    return { id };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await org(context.userId);
    const members = await sql<{
      id: string;
      user_id: string;
      role: string;
      name: string | null;
      email: string | null;
    }>`
      select m.id, m.user_id, m.role, p.name, p.email
      from organization_members m
      left join profiles p on p.user_id = m.user_id
      where m.organization_id = ${membership.orgId}
      order by m.created_at
    `;
    const invites = await sql<{
      id: string;
      email: string;
      role: string;
      created_at: string;
      accepted_at: string | null;
    }>`
      select id, email, role, created_at::text, accepted_at::text
      from team_invites where organization_id = ${membership.orgId} and accepted_at is null
      order by created_at desc
    `;
    return { members, invites, role: membership.role };
  });

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; role: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await org(context.userId);
    if (!canAdmin(membership.role)) throw new Error("Only owners and admins can invite teammates.");
    const limits = await getPlanLimits(sql, membership.orgId);
    const usage = await getUsage(sql, membership.orgId);
    const check = assertWithinLimit(usage.members, limits.maxTeamMembers, 1, "Team members");
    if (!check.ok) throw new Error(check.message);
    const token = createId("inv");
    await sql`
      insert into team_invites (id, organization_id, email, role, token, invited_by)
      values (${createId("inv")}, ${membership.orgId}, ${data.email.toLowerCase()}, ${data.role}, ${token}, ${context.userId})
    `;
    return { token };
  });
