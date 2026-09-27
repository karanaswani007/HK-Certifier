import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orgAnalytics } from "@/lib/server/certs";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["org-analytics", days], queryFn: () => orgAnalytics({ data: { days } }) });
  const t = q.data?.totals;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Analytics</h1>
        <select className="h-10 rounded-[8px] border border-input bg-card px-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>3 months</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Generated" n={t?.certificates} />
        <Stat label="Emails sent" n={t?.emails} />
        <Stat label="Downloads" n={t?.downloads} />
        <Stat label="Verification views" n={t?.views} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Certificates generated</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={q.data?.series ?? []}>
              <XAxis dataKey="day" hide />
              <YAxis allowDecimals={false} width={28} />
              <Tooltip />
              <Bar dataKey="n" fill="#1b4f4a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, n }: { label: string; n?: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl tabular">{formatNumber(n ?? 0)}</p>
      </CardContent>
    </Card>
  );
}
