import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminListPayments, adminReviewPayment } from "@/lib/server/admin";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments")({ component: AdminPayments });

function AdminPayments() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-pay"], queryFn: () => adminListPayments() });
  const review = useMutation({
    mutationFn: (input: { id: string; action: "APPROVE" | "REJECT" | "CLARIFICATION" }) => adminReviewPayment({ data: input }),
    onSuccess: () => {
      toast.success("Payment updated");
      void qc.invalidateQueries({ queryKey: ["admin-pay"] });
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Payments</h1>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>UTR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.order_ref}</TableCell>
                <TableCell>{p.org_name}</TableCell>
                <TableCell>₹{formatNumber(p.amount_inr)}</TableCell>
                <TableCell className="font-mono text-xs">{p.utr}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => review.mutate({ id: p.id, action: "APPROVE" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: p.id, action: "REJECT" })}>
                    Reject
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
