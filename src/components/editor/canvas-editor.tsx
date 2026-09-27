import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Lock,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Unlock,
} from "lucide-react";
import { CertificateArt } from "@/components/certificate/art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BUILTIN_VARIABLES, type CertElement, type CertLayout } from "@/lib/certifier/types";
import { cn } from "@/lib/utils";

function uid() {
  return `el_${Math.random().toString(36).slice(2, 9)}`;
}

export function CanvasEditor({
  value,
  onChange,
  onSave,
}: {
  value: CertLayout;
  onChange: (layout: CertLayout) => void;
  onSave: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [history, setHistory] = useState<CertLayout[]>([value]);
  const [cursor, setCursor] = useState(0);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const next = structuredClone(history[cursor] ?? value);
      const el = next.elements.find((x) => x.id === drag.current!.id);
      if (!el || el.locked) return;
      el.x = Math.round(e.clientX - drag.current.dx);
      el.y = Math.round(e.clientY - drag.current.dy);
      commit(next, false);
    };
    const onUp = () => {
      if (drag.current) {
        drag.current = null;
        push(history[cursor] ?? value);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  const layout = history[cursor] ?? value;

  function commit(next: CertLayout, record = true) {
    onChange(next);
    if (!record) {
      setHistory((h) => {
        const copy = h.slice(0, cursor + 1);
        copy[cursor] = next;
        return copy;
      });
      return;
    }
    push(next);
  }

  function push(next: CertLayout) {
    setHistory((h) => {
      const copy = h.slice(0, cursor + 1);
      copy.push(next);
      return copy.slice(-40);
    });
    setCursor((c) => Math.min(c + 1, 39));
  }

  function undo() {
    if (cursor === 0) return;
    const next = cursor - 1;
    setCursor(next);
    onChange(history[next]!);
  }
  function redo() {
    if (cursor >= history.length - 1) return;
    const next = cursor + 1;
    setCursor(next);
    onChange(history[next]!);
  }

  const selectedEl = layout.elements.find((e) => e.id === selected);

  function updateEl(patch: Partial<CertElement>) {
    const next = structuredClone(layout);
    const el = next.elements.find((e) => e.id === selected);
    if (!el) return;
    Object.assign(el, patch);
    commit(next);
  }

  function addEl(type: CertElement["type"]) {
    const el: CertElement = {
      id: uid(),
      type,
      x: 120,
      y: 120,
      w: type === "qr" ? 96 : 360,
      h: type === "qr" ? 96 : 48,
      rotation: 0,
      zIndex: layout.elements.length + 2,
      locked: false,
      opacity: 1,
      text: type === "variable" ? "{{student_name}}" : type === "text" ? "Certificate text" : undefined,
      fontFamily: "Fraunces",
      fontSize: 24,
      align: "center",
      color: "#1a2a44",
      fill: type === "rect" ? "transparent" : undefined,
      stroke: type === "rect" || type === "line" ? "#1b4f4a" : undefined,
      strokeWidth: 2,
    };
    commit({ ...layout, elements: [...layout.elements, el] });
    setSelected(el.id);
  }

  function remove() {
    if (!selected) return;
    commit({ ...layout, elements: layout.elements.filter((e) => e.id !== selected) });
    setSelected(null);
  }

  function duplicate() {
    if (!selectedEl) return;
    const copy = { ...structuredClone(selectedEl), id: uid(), x: selectedEl.x + 16, y: selectedEl.y + 16 };
    commit({ ...layout, elements: [...layout.elements, copy] });
    setSelected(copy.id);
  }

  const preview = useMemo(
    () => ({
      ...layout,
      elements: layout.elements.map((el) =>
        el.text
          ? {
              ...el,
              text: el.text
                .replaceAll("{{student_name}}", "Asha Rao")
                .replaceAll("{{program_name}}", "10 Days IoT Internship")
                .replaceAll("{{organization_name}}", "Your Institute")
                .replaceAll("{{certificate_id}}", "HKC-2026-DEMO-XXXX")
                .replaceAll("{{issue_date}}", "16 Jan 2026")
                .replaceAll("{{duration}}", "10 days")
                .replaceAll("{{mentor_name}}", "Mentor")
                .replaceAll("{{verification_url}}", "/verify/demo"),
            }
          : el,
      ),
    }),
    [layout],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_1fr_280px]">
      <aside className="rounded-xl border border-border bg-card p-3">
        <p className="px-1 text-xs font-medium text-muted-foreground">Elements</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["text", "variable", "rect", "line", "qr", "signature"] as const).map((t) => (
            <Button key={t} size="sm" variant="outline" onClick={() => addEl(t)}>
              <Plus className="size-3" /> {t}
            </Button>
          ))}
        </div>
        <p className="mt-4 px-1 text-xs font-medium text-muted-foreground">Variables</p>
        <ScrollArea className="mt-2 h-56">
          <div className="space-y-1">
            {BUILTIN_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                className="block w-full rounded-[8px] px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                onClick={() => {
                  if (selectedEl && (selectedEl.type === "text" || selectedEl.type === "variable")) {
                    updateEl({ text: `${selectedEl.text ?? ""}{{${v}}}` });
                  } else {
                    addEl("variable");
                  }
                }}
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="overflow-auto rounded-xl border border-border bg-muted/40 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={undo}><Undo2 className="size-4" /> Undo</Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 className="size-4" /> Redo</Button>
          <Button size="sm" variant="outline" onClick={duplicate} disabled={!selected}><Copy className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={remove} disabled={!selected}><Trash2 className="size-4" /></Button>
          <label className="ml-auto flex items-center gap-2 text-xs">
            Zoom
            <input type="range" min={0.35} max={1} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <Button size="sm" onClick={onSave}>Save template</Button>
        </div>
        <div className="flex justify-center">
          <div
            style={{ width: layout.width * zoom, height: layout.height * zoom }}
            onPointerDown={(e) => {
              const target = (e.target as HTMLElement).closest("[data-el]") as HTMLElement | null;
              if (!target) {
                setSelected(null);
                return;
              }
              const id = target.dataset.el!;
              setSelected(id);
              const el = layout.elements.find((x) => x.id === id);
              if (!el || el.locked) return;
              drag.current = { id, dx: e.clientX - el.x, dy: e.clientY - el.y };
            }}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} className="relative">
              <CertificateArt layout={layout} selectedId={selected} interactive onSelect={setSelected} />
              {layout.elements.map((el) => (
                <div
                  key={`hit-${el.id}`}
                  data-el={el.id}
                  className={cn("absolute", selected === el.id && "ring-2 ring-primary")}
                  style={{ left: el.x, top: el.y, width: el.w, height: el.h, zIndex: 50 }}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Preview with sample data uses Asha Rao / 10 Days IoT Internship. Variables stay in the saved template.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm">Filled preview</summary>
          <div className="mt-3 overflow-auto">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: layout.width * zoom, height: layout.height * zoom }}>
              <CertificateArt layout={preview} />
            </div>
          </div>
        </details>
      </div>

      <aside className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">Canvas</p>
        <div className="mt-2 space-y-2">
          <Field label="Background">
            <Input type="color" value={layout.background} onChange={(e) => commit({ ...layout, background: e.target.value })} />
          </Field>
        </div>
        {selectedEl ? (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Selected · {selectedEl.type}</p>
              <Button size="icon" variant="ghost" onClick={() => updateEl({ locked: !selectedEl.locked })}>
                {selectedEl.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="X"><Input type="number" value={selectedEl.x} onChange={(e) => updateEl({ x: Number(e.target.value) })} /></Field>
              <Field label="Y"><Input type="number" value={selectedEl.y} onChange={(e) => updateEl({ y: Number(e.target.value) })} /></Field>
              <Field label="W"><Input type="number" value={selectedEl.w} onChange={(e) => updateEl({ w: Number(e.target.value) })} /></Field>
              <Field label="H"><Input type="number" value={selectedEl.h} onChange={(e) => updateEl({ h: Number(e.target.value) })} /></Field>
            </div>
            {(selectedEl.type === "text" || selectedEl.type === "variable" || selectedEl.type === "signature") && (
              <>
                <Field label="Text">
                  <textarea
                    className="min-h-20 w-full rounded-[8px] border border-input bg-card p-2 text-sm"
                    value={selectedEl.text ?? ""}
                    onChange={(e) => updateEl({ text: e.target.value })}
                  />
                </Field>
                <Field label="Size">
                  <Input type="number" value={selectedEl.fontSize ?? 16} onChange={(e) => updateEl({ fontSize: Number(e.target.value) })} />
                </Field>
                <Field label="Color">
                  <Input type="color" value={selectedEl.color ?? "#16181d"} onChange={(e) => updateEl({ color: e.target.value })} />
                </Field>
                <Field label="Align">
                  <select
                    className="h-10 w-full rounded-[8px] border border-input bg-card px-2 text-sm"
                    value={selectedEl.align ?? "left"}
                    onChange={(e) => updateEl({ align: e.target.value as CertElement["align"] })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
              </>
            )}
            {(selectedEl.type === "rect" || selectedEl.type === "line") && (
              <>
                <Field label="Stroke">
                  <Input type="color" value={selectedEl.stroke ?? "#16181d"} onChange={(e) => updateEl({ stroke: e.target.value })} />
                </Field>
                <Field label="Fill">
                  <Input value={selectedEl.fill ?? "transparent"} onChange={(e) => updateEl({ fill: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Select an element to edit properties, or add one from the left panel.</p>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
