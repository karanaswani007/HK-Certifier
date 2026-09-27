import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { ScaledCertificate } from "@/components/certificate/art";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  addLibraryTemplate,
  archiveTemplate,
  createBlankTemplate,
  duplicateTemplate,
  libraryTemplates,
  listTemplates,
} from "@/lib/server/catalog";
import { generateAiTemplate } from "@/lib/server/ai";

export const Route = createFileRoute("/app/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const library = useQuery({ queryKey: ["library"], queryFn: () => libraryTemplates() });
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("Create a professional certificate for a 10-day IoT internship conducted for engineering students.");

  const blank = useMutation({
    mutationFn: () => createBlankTemplate(),
    onSuccess: (r) => navigate({ to: "/app/templates/$id", params: { id: r.id } }),
  });
  const addLib = useMutation({
    mutationFn: (key: string) => addLibraryTemplate({ data: key }),
    onSuccess: (r) => {
      toast.success("Template added");
      void qc.invalidateQueries({ queryKey: ["templates"] });
      void navigate({ to: "/app/templates/$id", params: { id: r.id } });
    },
  });
  const ai = useMutation({
    mutationFn: () => generateAiTemplate({ data: { prompt } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("AI template ready — review it in the editor");
      setAiOpen(false);
      void navigate({ to: "/app/templates/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Templates</h1>
          <p className="text-sm text-muted-foreground">Library, canvas editor and AI-assisted designs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            Generate with AI
          </Button>
          <Button onClick={() => blank.mutate()}>Blank canvas</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(templates.data ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="overflow-hidden rounded-[8px] border border-border bg-muted/40 p-2">
                <ScaledCertificate layout={t.layout} maxWidth={360} />
              </div>
              <h3 className="mt-3 font-medium">{t.name}</h3>
              <p className="text-xs text-muted-foreground">{t.category}</p>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm">
                  <Link to="/app/templates/$id" params={{ id: t.id }}>
                    Edit
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicateTemplate({ data: t.id }).then(() => qc.invalidateQueries({ queryKey: ["templates"] }))}>
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => archiveTemplate({ data: t.id }).then(() => qc.invalidateQueries({ queryKey: ["templates"] }))}>
                  Archive
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <h2 className="font-display text-2xl">Library</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {(library.data ?? []).map((t) => (
            <button
              key={t.key}
              type="button"
              className="rounded-xl border border-border bg-card p-3 text-left hover:border-primary"
              onClick={() => addLib.mutate(t.key)}
            >
              <p className="text-sm font-medium">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI template generation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Describe the program. AI returns an editable layout — it will not publish until you save.
          </p>
          <Textarea className="mt-3" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button className="mt-3" onClick={() => ai.mutate()} disabled={ai.isPending}>
            {ai.isPending ? "Generating…" : "Generate design"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
