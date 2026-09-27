import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) {
    void navigate({ to: "/app" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message || "Could not sign in.");
      return;
    }
    void navigate({ to: "/app" });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <Link to="/" className="text-foreground">
          <Wordmark />
        </Link>
        <h1 className="mt-6 font-display text-2xl">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization teams and HK SoftTech admins.</p>
        {authEnabled ? (
          <>
            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Continue with email"}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/app" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Sign-in is disabled.</p>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          New organization?{" "}
          <Link to="/register" className="text-foreground underline-offset-4 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
