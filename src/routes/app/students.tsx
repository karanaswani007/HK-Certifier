import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { archiveStudents, importCsv, listPrograms, listStudents, previewCsv, saveStudent } from "@/lib/server/catalog";

export const Route = createFileRoute("/app/students")({ component: StudentsPage });

function StudentsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [programId, setProgramId] = useState("");
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => listPrograms() });
  const students = useQuery({
    queryKey: ["students", query, programId],
    queryFn: () => listStudents({ data: { query, programId: programId || undefined } }),
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", college: "", studentCode: "", programId: "" });

  const save = useMutation({
    mutationFn: () => saveStudent({ data: form }),
    onSuccess: () => {
      toast.success("Student saved");
      setManual(false);
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl">Students</h1>
          <p className="text-sm text-muted-foreground">{students.data?.total ?? 0} records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            Import CSV
          </Button>
          <Button onClick={() => setManual(true)}>Add student</Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input placeholder="Search name, email, ID, college" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select
          className="h-10 rounded-[8px] border border-input bg-card px-2 text-sm"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        >
          <option value="">All programs</option>
          {(programs.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selected.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              archiveStudents({ data: selected }).then(() => {
                setSelected([]);
                void qc.invalidateQueries({ queryKey: ["students"] });
              })
            }
          >
            Archive selected
          </Button>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>College</TableHead>
              <TableHead>Program</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(students.data?.rows ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) =>
                      setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((id) => id !== s.id)))
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                <TableCell>{s.college}</TableCell>
                <TableCell>{s.program_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={manual} onOpenChange={setManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Student ID" value={form.studentCode} onChange={(e) => setForm({ ...form, studentCode: e.target.value })} />
            <Input placeholder="College" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
            <select
              className="h-10 w-full rounded-[8px] border border-input bg-card px-2 text-sm"
              value={form.programId}
              onChange={(e) => setForm({ ...form, programId: e.target.value })}
            >
              <option value="">Program (optional)</option>
              {(programs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button onClick={() => save.mutate()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      <CsvWizard
        open={csvOpen}
        onOpenChange={setCsvOpen}
        programs={programs.data ?? []}
        onDone={() => void qc.invalidateQueries({ queryKey: ["students"] })}
      />
    </div>
  );
}

function CsvWizard({
  open,
  onOpenChange,
  programs,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programs: Array<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [programId, setProgramId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const preview = useQuery({
    queryKey: ["csv-preview", csv, mapping],
    queryFn: () => previewCsv({ data: { csv, mapping } }),
    enabled: csv.length > 10,
  });
  const headers = preview.data?.headers ?? [];
  const fields = ["full_name", "email", "phone", "student_id", "college", "course", "branch", "batch", "registration_number"];
  const run = useMutation({
    mutationFn: () => importCsv({ data: { csv, mapping: preview.data?.mapping ?? mapping, programId: programId || undefined } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} students`);
      if (res.errors.length) toast.message(`${res.errors.length} row warnings`);
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const errorCsv = useMemo(() => {
    const errs = preview.data?.preview.flatMap((p) => p.errors) ?? [];
    if (!errs.length) return "";
    return ["row,message", ...errs.map((e) => `${e.row},"${e.message}"`)].join("\n");
  }, [preview.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
        </DialogHeader>
        <ol className="list-decimal space-y-4 pl-4 text-sm">
          <li>
            Upload CSV
            <textarea
              className="mt-2 h-28 w-full rounded-[8px] border border-input p-2 font-mono text-xs"
              placeholder="name,email,college,course,branch,student_id"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-2 text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCsv(await file.text());
              }}
            />
          </li>
          <li>
            Map columns
            <div className="mt-2 grid gap-2">
              {fields.map((f) => (
                <label key={f} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{f}</span>
                  <select
                    className="h-9 rounded-[8px] border border-input bg-card px-2 text-sm"
                    value={(preview.data?.mapping ?? mapping)[f] ?? ""}
                    onChange={(e) => setMapping({ ...(preview.data?.mapping ?? mapping), [f]: e.target.value })}
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </li>
          <li>
            Preview / validate
            <p className="mt-1 text-muted-foreground">{preview.data?.total ?? 0} rows detected</p>
            <ul className="mt-2 max-h-32 overflow-auto text-xs">
              {(preview.data?.preview ?? []).map((p, i) => (
                <li key={i} className={p.errors.length ? "text-destructive" : ""}>
                  {p.record?.fullName ?? "Invalid"} {p.errors[0] ? `— ${p.errors[0].message}` : ""}
                </li>
              ))}
            </ul>
            {errorCsv && (
              <a
                className="mt-2 inline-block text-xs underline"
                href={`data:text/csv,${encodeURIComponent(errorCsv)}`}
                download="import-errors.csv"
              >
                Download error CSV
              </a>
            )}
          </li>
          <li>
            Program (optional)
            <select
              className="mt-2 h-10 w-full rounded-[8px] border border-input bg-card px-2"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">None</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </li>
        </ol>
        <Button className="mt-4" onClick={() => run.mutate()} disabled={run.isPending || !csv}>
          {run.isPending ? "Importing…" : "Confirm import"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
