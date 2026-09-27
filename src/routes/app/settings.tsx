import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceQuery } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listAuditLogs, updateOrganization } from "@/lib/server/workspace";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const ws = useWorkspaceQuery();
  const org = ws.data?.organization;
  const [form, setForm] = useState({
    name: "",
    type: "institute",
    officialEmail: "",
    phone: "",
    website: "",
    city: "",
    state: "",
    country: "India",
    contactPerson: "",
    description: "",
  });
  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name,
      type: org.type,
      officialEmail: org.officialEmail ?? "",
      phone: org.phone ?? "",
      website: org.website ?? "",
      city: org.city ?? "",
      state: org.state ?? "",
      country: org.country ?? "India",
      contactPerson: org.contactPerson ?? "",
      description: org.description ?? "",
    });
  }, [org]);
  const save = useMutation({
    mutationFn: () => updateOrganization({ data: form }),
    onSuccess: () => toast.success("Organization updated"),
    onError: (e: Error) => toast.error(e.message),
  });
  const logs = useQuery({ queryKey: ["audit-org"], queryFn: () => listAuditLogs() });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <div className="mt-4 grid gap-3">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input value={form.officialEmail} onChange={(e) => setForm({ ...form, officialEmail: e.target.value })} placeholder="Official email" />
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
          </div>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button onClick={() => save.mutate()}>Save</Button>
        </div>
      </div>
      <div>
        <h2 className="font-display text-2xl">Audit log</h2>
        <ul className="mt-4 max-h-[28rem] space-y-2 overflow-auto text-sm">
          {(logs.data ?? []).map((l) => (
            <li key={l.id} className="rounded-[8px] border border-border px-3 py-2">
              <span className="font-medium">{l.action}</span>
              <span className="ml-2 text-muted-foreground">{formatDateTime(l.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
