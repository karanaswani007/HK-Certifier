import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPaymentRequest, getBilling, submitPaymentProof } from "@/lib/server/billing";
import { formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/app/subscription")({ component: SubscriptionPage });

function SubscriptionPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["billing"], queryFn: () => getBilling() });
  const [active, setActive] = useState<{ id: string; orderRef: string; amount: number } | null>(null);
  const [utr, setUtr] = useState("");
  const [date, setDate] = useState("");
  const create = useMutation({
    mutationFn: (planId: string) => createPaymentRequest({ data: planId }),
    onSuccess: (r) => setActive(r),
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation({
    mutationFn: () => submitPaymentProof({ data: { id: active!.id, utr, paymentDate: date } }),
    onSuccess: () => {
      toast.success("Payment submitted for review");
      setActive(null);
      void qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
  const pay = q.data?.payment;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Current plan: {q.data?.subscription?.name ?? "Free"} ({q.data?.subscription?.status})
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(q.data?.plans ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-5">
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 font-display text-2xl">{p.priceInr ? `₹${formatNumber(p.priceInr)}` : "Free"}</p>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              {p.priceInr > 0 && (
                <Button className="mt-4" size="sm" onClick={() => create.mutate(p.id)}>
                  Pay with UPI QR
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {active && (
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-[180px_1fr]">
            <QrPlaceholder payload={`upi://pay?pa=${pay?.upiId}&am=${active.amount}&tn=${active.orderRef}`} />
            <div>
              <p className="font-medium">Pay ₹{formatNumber(active.amount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pay?.instructions}</p>
              <p className="mt-2 font-mono text-xs">Order {active.orderRef}</p>
              <p className="text-sm">UPI: {pay?.upiId} · {pay?.accountName}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <Input placeholder="UTR / UPI reference" value={utr} onChange={(e) => setUtr(e.target.value)} />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <Button className="mt-3" onClick={() => submit.mutate()} disabled={!utr}>
                Submit payment proof
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div>
        <h2 className="font-medium">Payment requests</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(q.data?.requests ?? []).map((r) => (
            <li key={r.id} className="flex justify-between rounded-[8px] border border-border px-3 py-2">
              <span className="font-mono text-xs">{r.order_ref}</span>
              <span>₹{formatNumber(r.amount_inr)} · {r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QrPlaceholder({ payload }: { payload: string }) {
  return (
    <div className="flex size-40 items-center justify-center rounded-[12px] border border-border bg-cream p-3">
      <QrImg value={payload} />
    </div>
  );
}

function QrImg({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");
  useQuery({
    queryKey: ["qr", value],
    queryFn: async () => {
      const QR = await import("qrcode");
      const svg = await QR.toString(value, { type: "svg", margin: 1, width: 180 });
      setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      return true;
    },
  });
  if (!src) return <span className="text-xs text-muted-foreground">QR</span>;
  return <img src={src} alt="Payment QR" className="size-full" />;
}
