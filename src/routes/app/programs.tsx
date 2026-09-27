import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deleteProgram, listPrograms, saveProgram } from "@/lib/server/catalog";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/programs")({ component: ProgramsPage });

type Form = {
  id?: string;
  name: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  duration: string;
  mentorName: string;
  location: string;
  certificateTitle: string;
  skills: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
};

const empty: Form = {
  name: "",
  type: "Internship",
  description: "",
  startDate: "",
  endDate: "",
  duration: "",
  mentorName: "",
  location: "",
  certificateTitle: "Certificate of Completion",
  skills: "",
  status: "DRAFT",
};

function ProgramsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["programs"], queryFn: () => listPrograms() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const save = useMutation({
    mutationFn: () => saveProgram({ data: form }),
    onSuccess: () => {
      toast.success("Program saved");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteProgram({ data: id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["programs"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Programs</h1>
          <p className="text-sm text-muted-foreground">Internships, workshops, bootcamps and courses.</p>
        </div>
        <Button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
        >
          New program
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.type}</TableCell>
                <TableCell>
                  {formatDate(p.start_date)} – {formatDate(p.end_date)}
                </TableCell>
                <TableCell className="tabular">{p.student_count}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setForm({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        description: p.description ?? "",
                        startDate: p.start_date ?? "",
                        endDate: p.end_date ?? "",
                        duration: p.duration ?? "",
                        mentorName: p.mentor_name ?? "",
                        location: p.location ?? "",
                        certificateTitle: p.certificate_title ?? "",
                        skills: p.skills ?? "",
                        status: p.status as Form["status"],
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>
                    Archive
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit program" : "New program"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name" className="md:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            </Field>
            <Field label="Status">
              <select
                className="h-10 w-full rounded-[8px] border border-input bg-card px-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Form["status"] })}
              >
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>COMPLETED</option>
                <option>ARCHIVED</option>
              </select>
            </Field>
            <Field label="Start">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
            <Field label="Duration">
              <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
            <Field label="Mentor">
              <Input value={form.mentorName} onChange={(e) => setForm({ ...form, mentorName: e.target.value })} />
            </Field>
            <Field label="Location" className="md:col-span-2">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Certificate title" className="md:col-span-2">
              <Input value={form.certificateTitle} onChange={(e) => setForm({ ...form, certificateTitle: e.target.value })} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
