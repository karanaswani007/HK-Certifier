import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      className="toaster"
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground border-border",
        },
      }}
    />
  );
}
