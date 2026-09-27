import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, Flag, LayoutDashboard, LifeBuoy, ScrollText, Settings, Shield } from "lucide-react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/brand/logo";
import { getWorkspace } from "@/lib/server/workspace";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/plans", label: "Plans", icon: Flag },
  { to: "/admin/audit", label: "Audit", icon: ScrollText },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell() {
  const { user, isPending } = useCurrentUserState();
  const ws = useQuery({ queryKey: ["workspace"], queryFn: () => getWorkspace() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isPending || ws.isLoading) return <div className="grid min-h-screen place-items-center text-sm">Loading admin…</div>;
  if (!user) return <RedirectToSignIn to="/login" />;
  if (ws.data && !ws.data.isPlatformAdmin) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <Shield className="mx-auto size-8 text-primary" />
          <h1 className="mt-3 font-display text-2xl">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">This area is limited to HK SoftTech platform operators.</p>
          <Link to="/app" className="mt-4 inline-block text-sm underline">
            Back to organization
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 border-r border-border bg-card md:block">
        <div className="flex h-16 items-center px-4">
          <Wordmark />
        </div>
        <nav className="space-y-0.5 p-3">
          {NAV.map((n) => {
            const active = n.to === "/admin" ? pathname === "/admin" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
          <Link to="/app" className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            Organization app
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4">
          <p className="text-sm font-medium">HK SoftTech admin</p>
          <UserButton />
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
