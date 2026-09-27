import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { listPrograms, listStudents, listTemplates } from "@/lib/server/catalog";
import { createGenerationJob, processGenerationJob } from "@/lib/server/certs";

export const Route = createFileRoute("/app/generate")({ component: GeneratePage });

function GeneratePage() {
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => listPrograms() });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const [programId, setProgramId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const students = useQuery({
    queryKey: ["students", programId],
    queryFn: () => listStudents({ data: { programId: programId || undefined, page: 0 } }),
    enabled: Boolean(programId),
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ total: number; completed: number; failed: number; remaining: number } | null>(
    null,
  );

  const generate = useMutation({
    mutationFn: async () => {
      const ids = picked.length ? picked : (students.data?.rows ?? []).map((s) => s.id);
      if (!programId || !templateId || ids.length === 0) throw new Error("Select a program, template and students.");
      const job = await createGenerationJob({
        data: { programId, templateId, studentIds: ids, origin: window.location.origin },
      });
      let snap = await processGenerationJob({ data: { jobId: job.jobId, origin: window.location.origin } });
      setProgress(snap);
      while (snap.remaining > 0) {
        snap = await processGenerationJob({ data: { jobId: job.jobId, origin: window.location.origin } });
        setProgress(snap);
      }
      return snap;
    },
    onSuccess: (snap) => toast.success(`Generated ${snap.completed} certificates`),
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = progress ? Math.round(((progress.completed + progress.failed) / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Bulk generate</h1>
        <p className="text-sm text-muted-foreground">
          Jobs run in batches so a 1,000-student internship does not depend on one browser request.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Program
          <select className="mt-1 h-10 w-full rounded-[8px] border border-input bg-card px-2" value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">Select</option>
            {(programs.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Template
          <select className="mt-1 h-10 w-full rounded-[8px] border border-input bg-card px-2" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Select</option>
            {(templates.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium">Students ({students.data?.total ?? 0})</p>
          <p className="text-xs text-muted-foreground">Leave unselected to generate for everyone in the program.</p>
          <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
            {(students.data?.rows ?? []).map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={picked.includes(s.id)}
                    onChange={(e) =>
                      setPicked((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((id) => id !== s.id)))
                    }
                  />
                  {s.full_name} <span className="text-muted-foreground">{s.email}</span>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {progress && (
        <div>
          <p className="text-sm tabular">
            {progress.completed} / {progress.total} completed · {progress.failed} failed · {progress.remaining} remaining
          </p>
          <Progress className="mt-2" value={pct} />
        </div>
      )}
      <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
        {generate.isPending ? "Generating…" : "Generate certificates"}
      </Button>
    </div>
  );
}
