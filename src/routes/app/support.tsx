import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupportTicket, getSupportTicket, listSupportTickets, replySupportTicket } from "@/lib/server/billing";

export const Route = createFileRoute("/app/support")({ component: SupportPage });

function SupportPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tickets"], queryFn: () => listSupportTickets() });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createSupportTicket({ data: { subject, category: "general", priority: "normal", message } }),
    onSuccess: () => {
      toast.success("Ticket opened");
      setSubject("");
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
  const detail = useQuery({
    queryKey: ["ticket", active],
    queryFn: () => getSupportTicket({ data: active! }),
    enabled: Boolean(active),
  });
  const [reply, setReply] = useState("");
  const send = useMutation({
    mutationFn: () => replySupportTicket({ data: { id: active!, message: reply } }),
    onSuccess: () => {
      setReply("");
      void qc.invalidateQueries({ queryKey: ["ticket", active] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="font-display text-3xl">Support</h1>
        <div className="mt-4 space-y-2">
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button onClick={() => create.mutate()} disabled={!subject || !message}>
            Open ticket
          </Button>
        </div>
        <ul className="mt-6 space-y-2">
          {(q.data ?? []).map((t) => (
            <li key={t.id}>
              <button type="button" className="w-full rounded-[10px] border border-border px-3 py-2 text-left" onClick={() => setActive(t.id)}>
                <span className="font-medium">{t.subject}</span>
                <Badge className="ml-2" variant="secondary">{t.status}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {detail.data && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-xl">{detail.data.ticket.subject}</h2>
            <div className="mt-4 space-y-3 text-sm">
              {detail.data.messages.map((m) => (
                <p key={m.id} className={m.is_admin ? "text-primary" : ""}>
                  {m.body}
                </p>
              ))}
            </div>
            <Textarea className="mt-4" value={reply} onChange={(e) => setReply(e.target.value)} />
            <Button className="mt-2" onClick={() => send.mutate()}>
              Reply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
