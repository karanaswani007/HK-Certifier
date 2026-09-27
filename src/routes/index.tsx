import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  Check,
  FileSpreadsheet,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/layout/marketing-header";
import { internshipLayout } from "@/lib/certifier/default-templates";
import { ScaledCertificate } from "@/components/certificate/art";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listPublicPlans } from "@/lib/server/workspace";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const USE_CASES = [
  "Internships",
  "Workshops",
  "Training programs",
  "Colleges",
  "Universities",
  "Coaching institutes",
  "Corporate training",
  "Events",
  "Webinars",
  "Competitions",
  "Skill development",
  "Bootcamps",
  "Online courses",
];

function Home() {
  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => listPublicPlans() });
  const sample = internshipLayout();
  sample.elements = sample.elements.map((el) =>
    el.text?.includes("{{")
      ? {
          ...el,
          text: el.text
            .replaceAll("{{student_name}}", "Asha Rao")
            .replaceAll("{{program_name}}", "10 Days IoT Internship")
            .replaceAll("{{organization_name}}", "Demo Tech Institute")
            .replaceAll("{{start_date}}", "6 Jan 2026")
            .replaceAll("{{end_date}}", "16 Jan 2026")
            .replaceAll("{{duration}}", "10 days")
            .replaceAll("{{mentor_name}}", "Ananya Sharma")
            .replaceAll("{{issue_date}}", "16 Jan 2026")
            .replaceAll("{{certificate_id}}", "HKC-2026-IOT-A8F93KD2")
            .replaceAll("{{verification_url}}", "hkcertifier.app/verify/HKC-2026-IOT-A8F93KD2"),
        }
      : el,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-primary uppercase">
              HK Certifier
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-6xl">
              Create. Deliver. Verify.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Automate certificate creation and distribution for thousands of students. Import a CSV,
              design once, generate unique IDs and QR codes, email at scale, and let anyone verify in
              a scan.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/register">Register your organization</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/verify/$certificateId" params={{ certificateId: "HKC-2026-IOT-A8F93KD2" }}>
                  Try a live verification
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Developed by{" "}
              <a href="https://hksofttech.vercel.app" className="text-foreground underline-offset-4 hover:underline">
                HK SoftTech
              </a>
              . Practical digital support for institutes, training teams and events.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
            <ScaledCertificate layout={sample} maxWidth={560} />
          </div>
        </section>

        <section id="how" className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-3xl">How it works</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-5">
              {[
                { n: "01", t: "Register", d: "Create an organization and wait for HK SoftTech approval." },
                { n: "02", t: "Import", d: "Add a program and upload student data with a CSV wizard." },
                { n: "03", t: "Design", d: "Use the canvas editor or generate a template with AI." },
                { n: "04", t: "Generate", d: "Issue unique IDs, QR codes and PDFs in a background job." },
                { n: "05", t: "Verify", d: "Anyone can confirm authenticity from a public URL." },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-background p-5">
                  <p className="font-mono text-xs text-primary">{s.n}</p>
                  <h3 className="mt-2 font-medium">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl">Built for issuing at scale</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: FileSpreadsheet, t: "CSV automation", d: "Map columns, validate rows and import thousands of students without spreadsheet chaos." },
              { icon: Award, t: "Canvas editor", d: "Position text, marks, signatures and variables. Every generated file stays editable as a template." },
              { icon: QrCode, t: "QR verification", d: "Each certificate carries a unique ID and QR that opens a public, mobile-first verification page." },
              { icon: Users, t: "Email delivery", d: "Send, retry and track certificate emails in batches instead of a single fragile request." },
              { icon: BarChart3, t: "Analytics", d: "Watch generation, delivery, downloads and verification activity against your plan limits." },
              { icon: Sparkles, t: "AI templates", d: "Describe the program. Get a structured, fully editable certificate design — never a locked graphic." },
            ].map((f) => (
              <Card key={f.t}>
                <CardContent className="p-6">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-4 font-medium">{f.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-3xl">Who issues with HK Certifier</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {USE_CASES.map((c) => (
                <span key={c} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl">Plans that follow usage, not guesswork</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Limits live in the database and can be changed by HK SoftTech admin. Paid plans activate after QR
            payment is reviewed.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {(plans.data ?? []).map((p) => (
              <Card key={p.id} className={p.slug === "professional" ? "border-primary" : ""}>
                <CardContent className="flex h-full flex-col p-6">
                  <p className="text-sm text-muted-foreground">{p.name}</p>
                  <p className="mt-2 font-display text-3xl">
                    {p.priceInr === 0 ? "Free" : `₹${formatNumber(p.priceInr)}`}
                    {p.priceInr > 0 && <span className="text-base text-muted-foreground"> / mo</span>}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    <li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" /> {formatNumber(p.limits.monthlyCertificates)} certificates / month</li>
                    <li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" /> {formatNumber(p.limits.maxStudents)} students</li>
                    <li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" /> {p.limits.aiGeneration ? "AI templates" : "Library templates"}</li>
                    <li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" /> Public QR verification</li>
                  </ul>
                  <Button asChild className="mt-auto pt-6" variant={p.slug === "professional" ? "default" : "outline"}>
                    <Link to="/register">Get started</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="font-display text-3xl">Questions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Do students need an account?", "No. Verification and download work from the public URL or QR code. Private student records stay inside the organization."],
              ["How are certificates identified?", "Each issued certificate gets a unique public ID such as HKC-2026-IOT-A8F93KD2 — never a database row number."],
              ["Can we revoke a certificate?", "Yes. Public verification immediately shows Revoked. Reissue creates a new record linked to the original."],
              ["Who operates the platform?", "HK Certifier is developed by HK SoftTech, a technology partner for web, software, AI and training."],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-medium">{q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-xl border border-border bg-primary px-6 py-8 text-primary-foreground md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-2xl">Issue the next cohort with confidence.</p>
              <p className="mt-1 text-sm text-primary-foreground/80">Register, get approved, and run CREATE → IMPORT → GENERATE → DELIVER → VERIFY.</p>
            </div>
            <Button asChild variant="secondary">
              <Link to="/register">Register organization</Link>
            </Button>
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Multi-tenant isolation, hashed passwords, plan limits enforced on the server.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
