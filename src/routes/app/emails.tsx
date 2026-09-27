import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEmails, retryFailedEmails } from "@/lib/server/certs";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/app/emails")({ component: EmailsPage });

function EmailsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["emails"], queryFn: () => listEmails() });
  const retry = useMutation({
    mutationFn: () => retryFailedEmails(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["emails"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Email delivery</h1>
          <p className="text-sm text-muted-foreground">
            Provider: log/outbox. Configure Resend, SendGrid or SMTP in production without changing this workflow.
          </p>
        </div>
        <Button variant="outline" onClick={() => retry.mutate()}>
          Retry failed
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.to_email}</TableCell>
                <TableCell>{e.subject}</TableCell>
                <TableCell>
                  <Badge variant={e.status === "FAILED" ? "danger" : "success"}>{e.status}</Badge>
                </TableCell>
                <TableCell>{formatDateTime(e.sent_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
