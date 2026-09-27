import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  const { user, isPending } = useCurrentUserState();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="text-foreground">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="/#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="/#features" className="hover:text-foreground">
            Features
          </a>
          <a href="/#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link to="/verify/$certificateId" params={{ certificateId: "HKC-2026-IOT-A8F93KD2" }} className="hover:text-foreground">
            Verify
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <>
              <Button asChild size="sm">
                <Link to="/app">Dashboard</Link>
              </Button>
              <UserButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Register organization</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          HK Certifier · Create. Deliver. Verify.
          <span className="mt-1 block">Developed by HK SoftTech — technology partner for growth.</span>
        </p>
        <div className="flex gap-4">
          <a href="https://hksofttech.vercel.app" className="hover:text-foreground">
            HK SoftTech
          </a>
          <a href="/#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link to="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
