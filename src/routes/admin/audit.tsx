import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminListAudit } from "@/lib/server/admin";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({ component: AdminAudit });

function AdminAudit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => adminListAudit() });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Audit log</h1>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.action}</TableCell>
                <TableCell className="font-mono text-xs">{a.resource}</TableCell>
                <TableCell>{formatDateTime(a.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
