import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScaledCertificate } from "@/components/certificate/art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCertificate, queueCertificateEmails, recordDownload, reissueCertificate, revokeCertificate } from "@/lib/server/certs";

export const Route = createFileRoute("/app/certificates/$id")({ component: CertificateDetail });

function svgData(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function CertificateDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cert", id], queryFn: () => getCertificate({ data: id }) });
  const cert = q.data;

  const send = useMutation({
    mutationFn: () => queueCertificateEmails({ data: { certificateIds: [id], origin: window.location.origin } }),
    onSuccess: () => toast.success("Email queued"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !cert) return <Skeleton className="h-96" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
        <ScaledCertificate layout={cert.layout} qrSrc={cert.qr_svg ? svgData(cert.qr_svg) : undefined} maxWidth={820} />
      </div>
      <aside className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/certificates">Back</Link>
        </Button>
        <h1 className="font-display text-2xl">{cert.student_name}</h1>
        <Badge variant={cert.status === "VALID" ? "success" : "danger"}>{cert.status}</Badge>
        <p className="font-mono text-xs">{cert.public_id}</p>
        <p className="text-sm text-muted-foreground">{cert.program_name}</p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <a href={`/verify/${cert.public_id}`} target="_blank" rel="noreferrer">
              Public verification
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void recordDownload({ data: id });
              window.print();
            }}
          >
            Download / print
          </Button>
          <Button variant="outline" onClick={() => send.mutate()}>
            Send email
          </Button>
          {cert.status === "VALID" && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  revokeCertificate({ data: { id, reason: "Revoked by issuer" } }).then(() =>
                    qc.invalidateQueries({ queryKey: ["cert", id] }),
                  )
                }
              >
                Revoke
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  reissueCertificate({ data: { id, origin: window.location.origin } }).then(() =>
                    toast.success("Reissued"),
                  )
                }
              >
                Reissue
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
