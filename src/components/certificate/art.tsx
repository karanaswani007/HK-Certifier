import { useEffect, useMemo, useState } from "react";
import type { CertElement, CertLayout } from "@/lib/certifier/types";
import { cn } from "@/lib/utils";

function fontStack(family?: string) {
  if (family === "Fraunces") return `"Fraunces", Georgia, serif`;
  if (family === "IBM Plex Mono") return `"IBM Plex Mono", ui-monospace, monospace`;
  return `"Outfit", "Segoe UI", sans-serif`;
}

export function CertificateArt({
  layout,
  qrSrc,
  className,
  selectedId,
  onSelect,
  interactive = false,
}: {
  layout: CertLayout;
  qrSrc?: string;
  className?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  interactive?: boolean;
}) {
  const sorted = useMemo(
    () => [...layout.elements].sort((a, b) => a.zIndex - b.zIndex),
    [layout.elements],
  );

  return (
    <div
      className={cn("relative overflow-hidden shadow-[var(--shadow-soft)]", className)}
      style={{
        width: layout.width,
        height: layout.height,
        background: layout.background,
        backgroundImage: layout.backgroundImage ? `url(${layout.backgroundImage})` : undefined,
        backgroundSize: "cover",
      }}
      onMouseDown={() => interactive && onSelect?.(null)}
    >
      {sorted.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          qrSrc={qrSrc}
          selected={selectedId === el.id}
          interactive={interactive}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ElementView({
  el,
  qrSrc,
  selected,
  interactive,
  onSelect,
}: {
  el: CertElement;
  qrSrc?: string;
  selected: boolean;
  interactive: boolean;
  onSelect?: (id: string) => void;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    opacity: el.opacity,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center center",
    pointerEvents: interactive && !el.locked ? "auto" : "none",
    cursor: interactive ? "move" : "default",
    boxShadow: selected ? "0 0 0 2px #1b4f4a" : undefined,
    overflow: "hidden",
  };

  const handle = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect?.(el.id);
  };

  if (el.type === "rect") {
    return (
      <div
        style={{
          ...style,
          background: el.fill && el.fill !== "transparent" ? el.fill : undefined,
          border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
          borderRadius: el.borderRadius,
        }}
        onMouseDown={handle}
      />
    );
  }
  if (el.type === "line") {
    return (
      <div
        style={{
          ...style,
          height: Math.max(el.strokeWidth ?? el.h, 1),
          background: el.stroke ?? el.fill ?? "#16181d",
        }}
        onMouseDown={handle}
      />
    );
  }
  if (el.type === "image" && el.src) {
    return (
      <img
        src={el.src}
        alt=""
        crossOrigin="anonymous"
        style={{ ...style, objectFit: "contain" }}
        onMouseDown={handle}
      />
    );
  }
  if (el.type === "qr") {
    return (
      <div style={{ ...style, background: "#fff", padding: 4 }} onMouseDown={handle}>
        {qrSrc ? (
          <img src={qrSrc} alt="Verification QR" className="h-full w-full object-contain" />
        ) : (
          <QrInline value="https://hksofttech.vercel.app" />
        )}
      </div>
    );
  }
  if (el.type === "text" || el.type === "variable" || el.type === "signature") {
    return (
      <div
        style={{
          ...style,
          color: el.color ?? "#16181d",
          fontFamily: fontStack(el.fontFamily),
          fontSize: el.fontSize ?? 16,
          fontWeight: el.fontWeight ?? 400,
          textAlign: el.align ?? "left",
          letterSpacing: el.letterSpacing,
          lineHeight: el.lineHeight ?? 1.3,
          whiteSpace: "pre-wrap",
          display: "flex",
          alignItems: "center",
          justifyContent:
            el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
        }}
        onMouseDown={handle}
      >
        {el.text}
      </div>
    );
  }
  return null;
}

function QrInline({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toString(value, { type: "svg", margin: 0, width: 128 }).then((svg) => {
        if (alive) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      }),
    );
    return () => {
      alive = false;
    };
  }, [value]);
  if (!src) return <div className="h-full w-full bg-muted" />;
  return <img src={src} alt="" className="h-full w-full object-contain" />;
}

export function CertificateFrame({
  layout,
  qrSrc,
  className,
}: {
  layout: CertLayout;
  qrSrc?: string;
  className?: string;
}) {
  const scale = 1;
  return (
    <div className={cn("flex justify-center overflow-auto", className)}>
      <div
        style={{
          width: layout.width * scale,
          height: layout.height * scale,
        }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <CertificateArt layout={layout} qrSrc={qrSrc} />
        </div>
      </div>
    </div>
  );
}

export function ScaledCertificate({
  layout,
  qrSrc,
  maxWidth,
}: {
  layout: CertLayout;
  qrSrc?: string;
  maxWidth: number;
}) {
  const scale = Math.min(1, maxWidth / layout.width);
  return (
    <div
      className="relative mx-auto"
      style={{ width: layout.width * scale, height: layout.height * scale }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <CertificateArt layout={layout} qrSrc={qrSrc} />
      </div>
    </div>
  );
}
