import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCertificates, queueCertificateEmails, revokeCertificate } from "@/lib/server/certs";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/certificates")({ component: CertificatesPage });

function CertificatesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const q = useQuery({
    queryKey: ["certs", query, status],
    queryFn: () => listCertificates({ data: { query, status: status || undefined } }),
  });
  const email = useMutation({
    mutationFn: () =>
      queueCertificateEmails({
        data: { certificateIds: selected, origin: window.location.origin },
      }),
    onSuccess: (r) => {
      toast.success(`Queued ${r.queued} emails`);
      void qc.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl">Certificates</h1>
          <p className="text-sm text-muted-foreground">{q.data?.total ?? 0} issued</p>
        </div>
        <Button asChild>
          <Link to="/app/generate">Generate</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input placeholder="Search ID, student, program" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="h-10 rounded-[8px] border border-input bg-card px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>VALID</option>
          <option>REVOKED</option>
          <option>REISSUED</option>
          <option>EXPIRED</option>
        </select>
        {selected.length > 0 && (
          <Button variant="outline" onClick={() => email.mutate()}>
            Email selected
          </Button>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Certificate ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data?.rows ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((id) => id !== c.id)))
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{c.public_id}</TableCell>
                <TableCell>{c.student_name}</TableCell>
                <TableCell>{c.program_name}</TableCell>
                <TableCell>{formatDate(c.issue_date)}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "VALID" ? "success" : c.status === "REVOKED" ? "danger" : "secondary"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/app/certificates/$id" params={{ id: c.id }}>
                      View
                    </Link>
                  </Button>
                  {c.status === "VALID" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        revokeCertificate({ data: { id: c.id } }).then(() => qc.invalidateQueries({ queryKey: ["certs"] }))
                      }
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
