import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { adminListFlags, adminListPlans, adminSavePlan, adminToggleFlag } from "@/lib/server/admin";
import { useState } from "react";

export const Route = createFileRoute("/admin/plans")({ component: AdminPlans });

function AdminPlans() {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminListPlans() });
  const flags = useQuery({ queryKey: ["admin-flags"], queryFn: () => adminListFlags() });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Plans & flags</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(plans.data ?? []).map((p) => (
          <PlanEditor
            key={p.id}
            plan={p}
            onSave={(data) =>
              adminSavePlan({ data }).then(() => {
                toast.success("Plan saved");
                void qc.invalidateQueries({ queryKey: ["admin-plans"] });
              })
            }
          />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Feature flags</h2>
        <ul className="mt-3 space-y-3">
          {(flags.data ?? []).map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{f.key}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
              <Switch
                checked={f.enabled}
                onCheckedChange={(enabled) =>
                  adminToggleFlag({ data: { key: f.key, enabled } }).then(() =>
                    qc.invalidateQueries({ queryKey: ["admin-flags"] }),
                  )
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: Awaited<ReturnType<typeof adminListPlans>>[number];
  onSave: (data: Parameters<typeof adminSavePlan>[0]["data"]) => void;
}) {
  const [price, setPrice] = useState(plan.priceInr);
  const [certs, setCerts] = useState(plan.limits.monthlyCertificates);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="text-sm">
          Price (INR)
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          Monthly certificates
          <Input type="number" value={certs} onChange={(e) => setCerts(Number(e.target.value))} />
        </label>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              id: plan.id,
              name: plan.name,
              description: plan.description ?? undefined,
              priceInr: price,
              monthlyCertificates: certs,
              monthlyEmails: plan.limits.monthlyEmails,
              maxStudents: plan.limits.maxStudents,
              maxPrograms: plan.limits.maxPrograms,
              maxTemplates: plan.limits.maxTemplates,
              maxTeamMembers: plan.limits.maxTeamMembers,
              storageMb: plan.limits.storageMb,
              advancedAnalytics: plan.limits.advancedAnalytics,
              aiGeneration: plan.limits.aiGeneration,
              customBranding: plan.limits.customBranding,
              bulkOperations: plan.limits.bulkOperations,
              apiAccess: plan.limits.apiAccess,
              prioritySupport: plan.limits.prioritySupport,
              whiteLabel: plan.limits.whiteLabel,
            })
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
