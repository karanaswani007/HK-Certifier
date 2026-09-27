import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listVerificationLogs } from "@/lib/server/certs";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/app/verification")({ component: VerificationPage });

function VerificationPage() {
  const q = useQuery({ queryKey: ["ver-logs"], queryFn: () => listVerificationLogs() });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Verification log</h1>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.public_id}</TableCell>
                <TableCell>{v.result}</TableCell>
                <TableCell>{formatDateTime(v.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
