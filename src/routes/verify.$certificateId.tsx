import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Download, Share2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { MarketingFooter, MarketingHeader } from "@/components/layout/marketing-header";
import { ScaledCertificate } from "@/components/certificate/art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicDownload, verifyCertificate } from "@/lib/server/public";
import { formatDate, formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/verify/$certificateId")({
  component: VerifyPage,
});

function svgData(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function statusVariant(status: string) {
  if (status === "VALID") return "success" as const;
  if (status === "REVOKED") return "danger" as const;
  return "secondary" as const;
}

function VerifyPage() {
  const { certificateId } = Route.useParams();
  const [lookup, setLookup] = useState(certificateId);
  const q = useQuery({
    queryKey: ["verify", certificateId],
    queryFn: () => verifyCertificate({ data: certificateId }),
  });
  const dl = useMutation({ mutationFn: () => publicDownload({ data: certificateId }) });

  const result = q.data;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Public verification</p>
        <h1 className="mt-2 font-display text-3xl">Certificate authenticity</h1>
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.assign(`/verify/${lookup.trim().toUpperCase()}`);
          }}
        >
          <Input value={lookup} onChange={(e) => setLookup(e.target.value)} aria-label="Certificate ID" />
          <Button type="submit">Verify</Button>
        </form>

        {q.isLoading && <p className="mt-10 text-sm text-muted-foreground">Checking the register…</p>}
        {result && !result.found && (
          <div className="mt-10 rounded-xl border border-border bg-card p-8">
            <ShieldAlert className="size-8 text-destructive" />
            <h2 className="mt-3 font-display text-2xl">Certificate not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No issued certificate matches {certificateId}. Check the ID on the document or QR code.
            </p>
          </div>
        )}
        {result && result.found && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px]">
            <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
              <ScaledCertificate
                layout={result.layout}
                qrSrc={result.qrSvg ? svgData(result.qrSvg) : undefined}
                maxWidth={760}
              />
            </div>
            <aside className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  {result.status === "VALID" ? (
                    <ShieldCheck className="size-5 text-success" />
                  ) : (
                    <ShieldAlert className="size-5 text-destructive" />
                  )}
                  <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
                </div>
                {result.status === "REVOKED" && (
                  <p className="mt-3 text-sm text-destructive">
                    Certificate revoked{result.revokedReason ? ` — ${result.revokedReason}` : ""}.
                  </p>
                )}
                <dl className="mt-4 space-y-2 text-sm">
                  <Row k="Student" v={result.studentName} />
                  <Row k="Program" v={result.programName} />
                  <Row k="Organization" v={result.organizationName} />
                  <Row k="Title" v={result.title} />
                  <Row k="Issued" v={formatDate(result.issueDate)} />
                  <Row k="Duration" v={result.duration} />
                  <Row k="Certificate ID" v={result.publicId} />
                  <Row k="Checked" v={formatDateTime(result.verifiedAt)} />
                </dl>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    dl.mutate();
                    window.print();
                  }}
                  disabled={result.status !== "VALID"}
                >
                  <Download className="size-4" /> Download / print
                </Button>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                  <Copy className="size-4" /> Copy verification link
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Share2 className="size-4" /> Share on LinkedIn
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Verified certificate ${result.publicId} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                </Button>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5" />
                This page is public by design. It does not expose phone numbers or other private student fields.
              </p>
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Issued with HK Certifier
              </Link>
            </aside>
          </div>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
