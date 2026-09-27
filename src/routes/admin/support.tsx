import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminListTickets, adminReplyTicket } from "@/lib/server/admin";

export const Route = createFileRoute("/admin/support")({ component: AdminSupport });

function AdminSupport() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-tickets"], queryFn: () => adminListTickets() });
  const [id, setId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: () => adminReplyTicket({ data: { id: id!, message, status: "IN_PROGRESS" } }),
    onSuccess: () => {
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Support inbox</h1>
      <ul className="space-y-2">
        {(q.data ?? []).map((t) => (
          <li key={t.id}>
            <button type="button" className="w-full rounded-[10px] border border-border px-3 py-2 text-left" onClick={() => setId(t.id)}>
              {t.subject} · {t.status}
            </button>
          </li>
        ))}
      </ul>
      {id && (
        <div>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button className="mt-2" onClick={() => send.mutate()}>
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}
