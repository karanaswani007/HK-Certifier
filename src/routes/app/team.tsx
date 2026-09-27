import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inviteTeammate, listTeam } from "@/lib/server/catalog";

export const Route = createFileRoute("/app/team")({ component: TeamPage });

function TeamPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ORGANIZATION_EDITOR");
  const invite = useMutation({
    mutationFn: () => inviteTeammate({ data: { email, role } }),
    onSuccess: () => {
      toast.success("Invite created");
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Team</h1>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input placeholder="colleague@institute.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="h-10 rounded-[8px] border border-input bg-card px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option>ORGANIZATION_ADMIN</option>
          <option>ORGANIZATION_EDITOR</option>
          <option>ORGANIZATION_VIEWER</option>
        </select>
        <Button onClick={() => invite.mutate()}>Invite</Button>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data?.members ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.name ?? m.user_id}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role.replace("ORGANIZATION_", "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
