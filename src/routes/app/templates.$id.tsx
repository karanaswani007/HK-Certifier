import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CanvasEditor } from "@/components/editor/canvas-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getTemplate, saveTemplate } from "@/lib/server/catalog";
import type { CertLayout } from "@/lib/certifier/types";

export const Route = createFileRoute("/app/templates/$id")({ component: EditorPage });

function EditorPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["template", id], queryFn: () => getTemplate({ data: id }) });
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<CertLayout | null>(null);

  useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setLayout(q.data.layout);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveTemplate({
        data: { id, name, category: q.data?.category ?? "Custom", layout: layout! },
      }),
    onSuccess: () => toast.success("Template saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !layout) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/templates">Back</Link>
        </Button>
        <Input className="max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <CanvasEditor value={layout} onChange={setLayout} onSave={() => save.mutate()} />
    </div>
  );
}
