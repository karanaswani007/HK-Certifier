import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registerOrganization } from "@/lib/server/workspace";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [account, setAccount] = useState({ name: "", email: "", password: "" });
  const [org, setOrg] = useState({
    name: "",
    type: "institute",
    officialEmail: "",
    phone: "",
    website: "",
    city: "",
    state: "",
    country: "India",
    contactPerson: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ensureAccount() {
    if (user) return;
    const res = await authClient.signUp.email({
      email: account.email,
      password: account.password,
      name: account.name,
    });
    if (res.error) throw new Error(res.error.message || "Could not create account.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureAccount();
      await registerOrganization({ data: org });
      void navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <Link to="/" className="text-foreground">
        <Wordmark />
      </Link>
      <h1 className="mt-8 font-display text-3xl">Register your organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        HK SoftTech reviews every organization before certificate tools are enabled.
      </p>
      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        {!user && !isPending && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-medium">Your account</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Full name">
                <Input required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" required value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
              </Field>
              <Field label="Password" className="md:col-span-2">
                <Input type="password" required minLength={8} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
              </Field>
            </div>
            {authEnabled && (
              <div className="mt-4 flex flex-wrap gap-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button key={p.providerId} type="button" variant="outline" size="sm" onClick={() => signIn(p.providerId, { callbackURL: "/register" })}>
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Organization</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Organization name" className="md:col-span-2">
              <Input required value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Input value={org.type} onChange={(e) => setOrg({ ...org, type: e.target.value })} />
            </Field>
            <Field label="Official email">
              <Input type="email" value={org.officialEmail} onChange={(e) => setOrg({ ...org, officialEmail: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={org.state} onChange={(e) => setOrg({ ...org, state: e.target.value })} />
            </Field>
            <Field label="Contact person">
              <Input value={org.contactPerson} onChange={(e) => setOrg({ ...org, contactPerson: e.target.value })} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea value={org.description} onChange={(e) => setOrg({ ...org, description: e.target.value })} />
            </Field>
          </div>
        </section>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit for approval"}
        </Button>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
