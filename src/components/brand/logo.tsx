import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
      <rect x="7" y="8" width="18" height="16" rx="1.5" fill="#f4f1ea" />
      <path d="M12 12h2.2v3.1H16.6V12H18.8v8H16.6v-3.2h-2.4V20H12V12Z" fill="#1b4f4a" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-8" />
      <span className="font-display text-lg font-semibold tracking-tight">HK Certifier</span>
    </span>
  );
}
