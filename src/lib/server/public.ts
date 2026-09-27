import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { blankLayout } from "@/lib/certifier/default-templates";
import { createId } from "@/lib/certifier/ids";
import type { CertLayout } from "@/lib/certifier/types";
import { hashIp, parseJson } from "./helpers";
import { ensurePlatformSeed } from "./seed";

const verifyHits = new Map<string, { n: number; t: number }>();

function rateLimit(key: string, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const rec = verifyHits.get(key);
  if (!rec || now - rec.t > windowMs) {
    verifyHits.set(key, { n: 1, t: now });
    return;
  }
  rec.n += 1;
  if (rec.n > limit) throw new Error("Too many verification requests. Please wait a moment.");
}

export const verifyCertificate = createServerFn({ method: "GET" })
  .validator((publicId: string) => publicId.trim().toUpperCase())
  .handler(async ({ data: publicId }) => {
    const sql = await getSql();
    await ensurePlatformSeed(sql);
    rateLimit(`verify:${publicId}`);
    const rows = await sql<{
      id: string;
      public_id: string;
      student_name: string;
      organization_name: string | null;
      program_name: string | null;
      title: string | null;
      duration: string | null;
      issue_date: string | null;
      status: string;
      layout_json: string;
      qr_svg: string | null;
      revoked_reason: string | null;
    }>`
      select id, public_id, student_name, organization_name, program_name, title, duration,
             issue_date::text, status, layout_json, qr_svg, revoked_reason
      from certificates where public_id = ${publicId}
    `;
    const cert = rows[0];
    await sql`
      insert into verification_events (id, certificate_id, public_id, result, ip_hash)
      values (${createId("ver")}, ${cert?.id ?? null}, ${publicId}, ${cert ? cert.status : "NOT_FOUND"}, ${hashIp("anon")})
    `;
    if (!cert) return { found: false as const, publicId };
    await sql`update certificates set view_count = view_count + 1 where id = ${cert.id}`;
    return {
      found: true as const,
      publicId: cert.public_id,
      studentName: cert.student_name,
      organizationName: cert.organization_name,
      programName: cert.program_name,
      title: cert.title,
      duration: cert.duration,
      issueDate: cert.issue_date,
      status: cert.status,
      revokedReason: cert.revoked_reason,
      layout: parseJson<CertLayout>(cert.layout_json, blankLayout()),
      qrSvg: cert.qr_svg,
      verifiedAt: new Date().toISOString(),
    };
  });

export const publicDownload = createServerFn({ method: "POST" })
  .validator((publicId: string) => publicId.trim().toUpperCase())
  .handler(async ({ data: publicId }) => {
    const sql = await getSql();
    await sql`update certificates set download_count = download_count + 1 where public_id = ${publicId} and status = 'VALID'`;
    return { ok: true };
  });
