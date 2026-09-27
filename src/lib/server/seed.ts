import { auth } from "@/lib/auth/server";
import { readDefaultAdminConfig } from "@/lib/auth/default-admin";
import type { Sql } from "@/lib/db";
import { DEFAULT_TEMPLATE_DEFS } from "@/lib/certifier/default-templates";
import { createId } from "@/lib/certifier/ids";
import { applyLayoutVariables } from "@/lib/certifier/variables";
import { qrSvg } from "@/lib/certifier/qr";
import type { CertLayout } from "@/lib/certifier/types";

export const DEMO_ORG_ID = "org_demo";

const PROGRAMS = [
  {
    id: "prg_iot",
    name: "10 Days IoT Internship",
    type: "Internship",
    description: "Hands-on Internet of Things internship covering sensors, microcontrollers and cloud dashboards.",
    start: "2026-01-06",
    end: "2026-01-16",
    duration: "10 days",
    mentor: "Ananya Sharma",
    location: "Hybrid · Bengaluru",
    title: "Certificate of Completion",
    skills: "IoT, Embedded C, MQTT, Sensors",
    status: "ACTIVE",
  },
  {
    id: "prg_web",
    name: "Web Development Workshop",
    type: "Workshop",
    description: "A practical workshop on modern web applications with React and TypeScript.",
    start: "2026-02-10",
    end: "2026-02-12",
    duration: "3 days",
    mentor: "Rahul Mehta",
    location: "Online",
    title: "Workshop Certificate",
    skills: "React, TypeScript, Tailwind",
    status: "ACTIVE",
  },
  {
    id: "prg_ai",
    name: "AI Fundamentals Bootcamp",
    type: "Bootcamp",
    description: "Foundations of applied AI for engineering students.",
    start: "2026-03-01",
    end: "2026-03-14",
    duration: "14 days",
    mentor: "Dr. Kavya Nair",
    location: "Pune",
    title: "Certificate of Achievement",
    skills: "Python, LLMs, Prompting, Evaluation",
    status: "COMPLETED",
  },
];

const NAMES = [
  ["Asha Rao", "asha.rao@student.example", "NITK", "ECE"],
  ["Mohammed Irfan", "irfan.m@student.example", "VIT Vellore", "CSE"],
  ["Priya Nair", "priya.nair@student.example", "NIT Calicut", "ECE"],
  ["Arjun Patel", "arjun.patel@student.example", "DAIICT", "ICT"],
  ["Sneha Iyer", "sneha.iyer@student.example", "COEP Pune", "E&TC"],
  ["Karan Singh", "karan.singh@student.example", "DTU", "CSE"],
  ["Meera Joshi", "meera.joshi@student.example", "SRM Chennai", "IT"],
  ["Dev Sharma", "dev.sharma@student.example", "BITS Pilani", "EEE"],
  ["Fatima Khan", "fatima.khan@student.example", "Jamia Millia", "CSE"],
  ["Nikhil Reddy", "nikhil.reddy@student.example", "IIIT Hyderabad", "ECE"],
  ["Anjali Gupta", "anjali.gupta@student.example", "NSUT", "IT"],
  ["Rohit Das", "rohit.das@student.example", "Jadavpur University", "ETCE"],
  ["Ishita Bose", "ishita.bose@student.example", "IEM Kolkata", "CSE"],
  ["Vikram Rao", "vikram.rao@student.example", "RVCE", "ISE"],
  ["Neha Kulkarni", "neha.k@student.example", "PICT Pune", "AI&DS"],
  ["Siddharth Menon", "sid.menon@student.example", "CET Trivandrum", "CSE"],
  ["Pooja Verma", "pooja.verma@student.example", "MAIT Delhi", "ECE"],
  ["Aditya Jain", "aditya.jain@student.example", "LNMIIT", "CCE"],
  ["Riya Shah", "riya.shah@student.example", "Nirma University", "CSE"],
  ["Harsh Vardhan", "harsh.v@student.example", "NIT Trichy", "ICE"],
  ["Tanvi Deshmukh", "tanvi.d@student.example", "VJTI Mumbai", "EXTC"],
  ["Yusuf Ali", "yusuf.ali@student.example", "Osmania University", "CSE"],
  ["Lakshmi Priya", "lakshmi.p@student.example", "PSG Coimbatore", "IT"],
  ["Kabir Malhotra", "kabir.m@student.example", "Thapar", "COE"],
];

const SAMPLE_CERTS = [
  {
    publicId: "HKC-2026-IOT-A8F93KD2",
    studentIndex: 0,
    programId: "prg_iot",
    templateKey: "internship",
    status: "VALID",
  },
  {
    publicId: "HKC-2026-WEB-B2K18QP4",
    studentIndex: 1,
    programId: "prg_web",
    templateKey: "workshop",
    status: "VALID",
  },
  {
    publicId: "HKC-2026-AI-C9M44LX1",
    studentIndex: 2,
    programId: "prg_ai",
    templateKey: "achievement",
    status: "REVOKED",
  },
];

export async function ensureDefaultAdmin(sql: Sql) {
  const config = readDefaultAdminConfig(process.env);
  if (!config.email || !config.password) return;

  const existingAdmins = await sql<{ user_id: string }>`select user_id from platform_admins limit 1`;
  if (existingAdmins[0]) return;

  const existingUser = await sql<{ id: string }>`
    select id from "user" where lower(email) = lower(${config.email}) limit 1
  `;

  const userId = existingUser[0]
    ? existingUser[0].id
    : (
        await auth.api.signUpEmail({
          body: {
            name: config.name,
            email: config.email,
            password: config.password,
          },
        })
      ).user.id;

  await sql`
    insert into platform_admins (user_id)
    values (${userId})
    on conflict (user_id) do nothing
  `;
}

export async function ensurePlatformSeed(sql: Sql) {
  await ensureDefaultAdmin(sql);

  const existing = await sql<{ id: string }>`select id from organizations where id = ${DEMO_ORG_ID}`;
  if (existing[0]) return;

  await sql`
    insert into organizations (
      id, name, slug, type, official_email, phone, website, city, state, country,
      contact_person, description, status, created_by
    ) values (
      ${DEMO_ORG_ID},
      ${"Demo Tech Institute"},
      ${"demo-tech-institute"},
      ${"institute"},
      ${"demo@hksofttech.in"},
      ${"+91 80000 00000"},
      ${"https://hksofttech.vercel.app"},
      ${"Bengaluru"},
      ${"Karnataka"},
      ${"India"},
      ${"Institute Admin"},
      ${"A demonstration organization used to explore HK Certifier: internships, workshops and bootcamps with verified certificates."},
      ${"APPROVED"},
      ${"system"}
    )
  `;

  await sql`
    insert into subscriptions (id, organization_id, plan_id, status, period_start, period_end)
    values (${"sub_demo"}, ${DEMO_ORG_ID}, ${"plan_professional"}, ${"ACTIVE"}, now(), now() + interval '1 year')
  `;

  for (const p of PROGRAMS) {
    await sql`
      insert into programs (
        id, organization_id, name, type, description, start_date, end_date, duration,
        mentor_name, location, certificate_title, skills, status
      ) values (
        ${p.id}, ${DEMO_ORG_ID}, ${p.name}, ${p.type}, ${p.description}, ${p.start}, ${p.end},
        ${p.duration}, ${p.mentor}, ${p.location}, ${p.title}, ${p.skills}, ${p.status}
      )
    `;
  }

  const studentIds: string[] = [];
  for (let i = 0; i < NAMES.length; i += 1) {
    const [fullName, email, college, branch] = NAMES[i]!;
    const id = `stu_demo_${String(i + 1).padStart(2, "0")}`;
    studentIds.push(id);
    const programId = i < 10 ? "prg_iot" : i < 17 ? "prg_web" : "prg_ai";
    await sql`
      insert into students (
        id, organization_id, program_id, full_name, email, student_code, college, course, branch, batch
      ) values (
        ${id}, ${DEMO_ORG_ID}, ${programId}, ${fullName}, ${email}, ${`DTI-2026-${String(i + 1).padStart(3, "0")}`},
        ${college}, ${"B.Tech"}, ${branch}, ${"2026"}
      )
    `;
  }

  const templateIds: Record<string, string> = {};
  for (const def of DEFAULT_TEMPLATE_DEFS) {
    const id = `tpl_${def.key}`;
    templateIds[def.key] = id;
    await sql`
      insert into certificate_templates (
        id, organization_id, name, category, description, layout_json, is_default
      ) values (
        ${id}, ${DEMO_ORG_ID}, ${def.name}, ${def.category}, ${def.description},
        ${JSON.stringify(def.layout)}, ${def.key === "internship"}
      )
    `;
  }

  for (const sample of SAMPLE_CERTS) {
    const student = NAMES[sample.studentIndex]!;
    const program = PROGRAMS.find((p) => p.id === sample.programId)!;
    const layout = DEFAULT_TEMPLATE_DEFS.find((t) => t.key === sample.templateKey)!.layout as CertLayout;
    const verifyUrl = `https://cert.hksofttech.in/verify/${sample.publicId}`;
    const values = {
      student_name: student[0],
      student_id: `DTI-2026-${String(sample.studentIndex + 1).padStart(3, "0")}`,
      student_email: student[1],
      college: student[2],
      course_name: "B.Tech",
      branch: student[3],
      batch: "2026",
      program_name: program.name,
      program_type: program.type,
      organization_name: "Demo Tech Institute",
      start_date: program.start,
      end_date: program.end,
      duration: program.duration,
      issue_date: program.end,
      certificate_id: sample.publicId,
      verification_url: verifyUrl,
      mentor_name: program.mentor,
      certificate_title: program.title,
      location: program.location,
    };
    const resolved = applyLayoutVariables(layout, values);
    const qr = await qrSvg(verifyUrl, 256);
    const certId = `crt_${sample.publicId.slice(-8).toLowerCase()}`;
    await sql`
      insert into certificates (
        id, organization_id, program_id, student_id, template_id, public_id, verification_token,
        title, student_name, student_email, organization_name, program_name, duration, issue_date,
        status, layout_json, qr_svg, revoked_at
      ) values (
        ${certId}, ${DEMO_ORG_ID}, ${sample.programId}, ${studentIds[sample.studentIndex]},
        ${templateIds[sample.templateKey]}, ${sample.publicId}, ${createId("tok")},
        ${program.title}, ${student[0]}, ${student[1]}, ${"Demo Tech Institute"}, ${program.name},
        ${program.duration}, ${program.end}, ${sample.status}, ${JSON.stringify(resolved)}, ${qr},
        ${sample.status === "REVOKED" ? new Date().toISOString() : null}
      )
    `;
  }

  await sql`
    insert into usage_counters (organization_id, period, certificates, emails)
    values (${DEMO_ORG_ID}, ${"2026-09"}, ${3}, ${2})
    on conflict do nothing
  `;
}
