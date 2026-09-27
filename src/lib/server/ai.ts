import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { blankLayout } from "@/lib/certifier/default-templates";
import { createId } from "@/lib/certifier/ids";
import type { CertLayout } from "@/lib/certifier/types";
import { getMembership, getPlanLimits, parseJson, requireApprovedOrg, writeAudit } from "./helpers";

const SYSTEM = `You generate editable certificate template JSON for HK Certifier.
Return ONLY valid JSON matching this TypeScript type, no markdown:
{
  "name": string,
  "category": string,
  "description": string,
  "layout": {
    "width": 1123,
    "height": 794,
    "orientation": "landscape",
    "background": string (hex),
    "elements": Array<{
      "id": string,
      "type": "text"|"variable"|"rect"|"line"|"image"|"qr"|"signature",
      "x": number, "y": number, "w": number, "h": number,
      "rotation": 0, "zIndex": number, "locked": false, "opacity": 1,
      "text"?: string,
      "fontFamily"?: "Fraunces"|"Outfit"|"IBM Plex Mono",
      "fontSize"?: number, "fontWeight"?: number,
      "align"?: "left"|"center"|"right",
      "color"?: string, "letterSpacing"?: number, "lineHeight"?: number,
      "fill"?: string, "stroke"?: string, "strokeWidth"?: number
    }>
  }
}
Use dynamic variables such as {{student_name}}, {{program_name}}, {{organization_name}}, {{certificate_id}}, {{issue_date}}, {{duration}}, {{verification_url}}, {{mentor_name}}.
Include a qr element. Keep text inside the 1123x794 canvas with 40px margins.
Do not use purple or neon colors. Prefer cream, ink, and deep teal.`;

export const generateAiTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { prompt: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const membership = await getMembership(sql, context.userId);
    if (!membership) throw new Error("No organization");
    await requireApprovedOrg(membership, true);
    const limits = await getPlanLimits(sql, membership.orgId);
    if (!limits.aiGeneration) {
      throw new Error("AI template generation is available on Starter and above.");
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not available in this environment." };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1800,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.prompt.slice(0, 800) },
        ],
      }),
    });
    if (!res.ok) {
      await sql`
        insert into ai_requests (id, organization_id, user_id, kind, prompt, status, error)
        values (${createId("ai")}, ${membership.orgId}, ${context.userId}, ${"template"}, ${data.prompt}, ${"FAILED"}, ${`xAI ${res.status}`})
      `;
      return { ok: false as const, error: `AI request failed (${res.status}).` };
    }
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const text = body.choices[0]?.message.content ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return { ok: false as const, error: "AI returned an unreadable design. Try a more specific prompt." };
    }
    let parsed: { name?: string; category?: string; description?: string; layout?: CertLayout };
    try {
      parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      return { ok: false as const, error: "AI returned invalid JSON. Try again." };
    }
    const layout = parsed.layout && Array.isArray(parsed.layout.elements) ? parsed.layout : blankLayout();
    layout.width = 1123;
    layout.height = 794;
    layout.orientation = "landscape";
    const id = createId("tpl");
    await sql`
      insert into certificate_templates (id, organization_id, name, category, description, layout_json)
      values (
        ${id}, ${membership.orgId}, ${parsed.name || "AI template"}, ${parsed.category || "AI"},
        ${parsed.description || data.prompt}, ${JSON.stringify(layout)}
      )
    `;
    await sql`
      insert into ai_requests (id, organization_id, user_id, kind, prompt, result_json, status)
      values (${createId("ai")}, ${membership.orgId}, ${context.userId}, ${"template"}, ${data.prompt}, ${JSON.stringify({ templateId: id })}, ${"SUCCESS"})
    `;
    await writeAudit(sql, {
      organizationId: membership.orgId,
      userId: context.userId,
      action: "ai.template.generated",
      resource: "template",
      resourceId: id,
    });
    return { ok: true as const, id, layout: parseJson<CertLayout>(JSON.stringify(layout), blankLayout()) };
  });
