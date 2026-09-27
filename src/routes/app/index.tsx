import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useWorkspaceQuery } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { orgAnalytics } from "@/lib/server/certs";
import { formatNumber } from "@/lib/utils";
import { usagePercent } from "@/lib/certifier/limits";

export const Route = createFileRoute("/app/")({ component: Overview });

function Overview() {
  const ws = useWorkspaceQuery();
  const analytics = useQuery({ queryKey: ["org-analytics"], queryFn: () => orgAnalytics({ data: { days: 30 } }) });
  const data = ws.data;
  const t = analytics.data?.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CREATE → IMPORT → GENERATE → DELIVER → VERIFY
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Certificates" value={t?.certificates} />
        <Stat label="Valid" value={t?.valid} />
        <Stat label="Students" value={t?.students} />
        <Stat label="Verifications" value={t?.views} />
      </div>
      {data?.subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Plan usage · {data.subscription.planName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Usage label="Certificates this month" used={data.usage.certificates} limit={data.subscription.limits.monthlyCertificates} />
            <Usage label="Emails this month" used={data.usage.emails} limit={data.subscription.limits.monthlyEmails} />
            <Usage label="Students" used={data.usage.students} limit={data.subscription.limits.maxStudents} />
            <Usage label="Templates" used={data.usage.templates} limit={data.subscription.limits.maxTemplates} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Quick to="/app/students" title="Import students" body="CSV wizard with mapping, validation and duplicates." />
        <Quick to="/app/templates" title="Design a template" body="Canvas editor with variables, or generate one with AI." />
        <Quick to="/app/generate" title="Bulk generate" body="Issue unique IDs, QR codes and verification URLs." />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl tabular">{formatNumber(value ?? 0)}</p>
      </CardContent>
    </Card>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = usagePercent(used, limit);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular text-muted-foreground">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function Quick({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link to={to}>
            Open <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
