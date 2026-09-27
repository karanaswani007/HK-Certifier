import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  CreditCard,
  FileBadge,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  Menu,
  QrCode,
  Send,
  Settings,
  Shield,
  Users,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspace, listNotifications } from "@/lib/server/workspace";
import { cn } from "@/lib/utils";
import type { WorkspaceSnapshot } from "@/lib/certifier/types";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/programs", label: "Programs", icon: GraduationCap },
  { to: "/app/students", label: "Students", icon: Users },
  { to: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/app/certificates", label: "Certificates", icon: FileBadge },
  { to: "/app/generate", label: "Bulk generate", icon: WandSparkles },
  { to: "/app/emails", label: "Email delivery", icon: Send },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/verification", label: "Verification", icon: QrCode },
  { to: "/app/subscription", label: "Subscription", icon: CreditCard },
  { to: "/app/team", label: "Team", icon: Inbox },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function useWorkspaceQuery() {
  return useQuery({ queryKey: ["workspace"], queryFn: () => getWorkspace() });
}

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const ws = useWorkspaceQuery();
  const [open, setOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/login" />;

  const data = ws.data;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-4">
          <Link to="/" className="text-foreground">
            <Wordmark />
          </Link>
        </div>
        <NavList onClick={() => undefined} isAdmin={data?.isPlatformAdmin} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{data?.organization?.name ?? "HK Certifier"}</p>
            {data?.organization && (
              <p className="text-xs text-muted-foreground">
                {data.organization.role.replace("ORGANIZATION_", "")} · {data.subscription?.planName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotifyBell />
            <UserButton />
          </div>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0">
            <div className="flex h-16 items-center px-4">
              <Wordmark />
            </div>
            <NavList onClick={() => setOpen(false)} isAdmin={data?.isPlatformAdmin} />
          </SheetContent>
        </Sheet>
        <main className="flex-1 p-4 md:p-8">
          {ws.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data?.needsOnboarding ? (
            <Onboarding />
          ) : data?.organization && data.organization.status !== "APPROVED" ? (
            <Pending org={data} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

function NavList({ onClick, isAdmin }: { onClick: () => void; isAdmin?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {NAV.map((item) => {
        const active = item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          to="/admin"
          onClick={onClick}
          className="mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Shield className="size-4" />
          Platform admin
        </Link>
      )}
    </nav>
  );
}

function NotifyBell() {
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications() });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  return (
    <Link to="/app" className="relative rounded-full p-2 hover:bg-muted" aria-label="Notifications">
      <Bell className="size-4" />
      {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />}
    </Link>
  );
}

function Onboarding() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8">
      <h1 className="font-display text-2xl">Create your organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Register your institute to start issuing verified certificates. HK SoftTech reviews every account.
      </p>
      <Button asChild className="mt-6">
        <Link to="/register">Continue registration</Link>
      </Button>
    </div>
  );
}

function Pending({ org }: { org: WorkspaceSnapshot }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8">
      <Badge variant="warn">{org.organization?.status}</Badge>
      <h1 className="mt-4 font-display text-2xl">Your organization account has been submitted for approval.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        HK SoftTech is reviewing {org.organization?.name}. You will be able to create programs, import students and
        generate certificates once the organization is approved.
      </p>
      {org.organization?.rejectionReason && (
        <p className="mt-4 text-sm">Note from admin: {org.organization.rejectionReason}</p>
      )}
    </div>
  );
}
