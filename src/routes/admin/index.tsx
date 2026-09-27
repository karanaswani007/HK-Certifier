import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { adminOverview } from "@/lib/server/admin";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });
  const d = q.data;
  const items = [
    ["Organizations", d?.orgs],
    ["Pending approvals", d?.pending],
    ["Active orgs", d?.approved],
    ["Certificates", d?.certificates],
    ["This month", d?.month_certs],
    ["Verifications", d?.verifications],
    ["Paid plans", d?.paid],
    ["Revenue (₹)", d?.revenue],
    ["Pending payments", d?.pending_pay],
  ];
  return (
    <div>
      <h1 className="font-display text-3xl">Platform</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([k, v]) => (
          <Card key={String(k)}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="mt-2 font-display text-3xl tabular">{formatNumber(Number(v ?? 0))}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
