import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminListOrganizations, adminReviewOrganization } from "@/lib/server/admin";

export const Route = createFileRoute("/admin/organizations")({ component: AdminOrgs });

function AdminOrgs() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["admin-orgs", query, status],
    queryFn: () => adminListOrganizations({ data: { query, status: status || undefined } }),
  });
  const review = useMutation({
    mutationFn: (input: { id: string; action: "APPROVE" | "REJECT" | "SUSPEND" | "ACTIVATE" | "REQUEST_CHANGES" }) =>
      adminReviewOrganization({ data: input }),
    onSuccess: () => {
      toast.success("Updated");
      void qc.invalidateQueries({ queryKey: ["admin-orgs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Organizations</h1>
      <div className="flex gap-2">
        <Input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="h-10 rounded-[8px] border border-input bg-card px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option>PENDING_APPROVAL</option>
          <option>APPROVED</option>
          <option>REJECTED</option>
          <option>SUSPENDED</option>
        </select>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{o.official_email}</TableCell>
                <TableCell>{o.plan_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{o.status}</Badge>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  {o.status !== "APPROVED" && (
                    <Button size="sm" onClick={() => review.mutate({ id: o.id, action: "APPROVE" })}>
                      Approve
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: o.id, action: "REJECT" })}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: o.id, action: "SUSPEND" })}>
                    Suspend
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
