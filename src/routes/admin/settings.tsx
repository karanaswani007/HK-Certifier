import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth/client";
import { adminSaveSettings, adminSettings } from "@/lib/server/admin";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminSettings() });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => adminSaveSettings({ data: form }),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await authClient.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setPasswordError(res.error.message || "Could not change password.");
        return;
      }
      toast.success("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  const keys = ["platform_name", "platform_tagline", "support_email", "payment_upi_id", "payment_account_name", "payment_instructions", "email_from_name"];
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-4">
        <h1 className="font-display text-3xl">System settings</h1>
        {keys.map((k) => (
          <label key={k} className="block text-sm">
            {k}
            {k === "payment_instructions" ? (
              <Textarea className="mt-1" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ) : (
              <Input className="mt-1" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            )}
          </label>
        ))}
        <Button onClick={() => save.mutate()}>Save</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-xl">Change admin password</h2>
        <form className="mt-4 space-y-3" onSubmit={handlePasswordChange}>
          <div className="space-y-1.5">
            <label className="text-sm">Current password</label>
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">New password</label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Confirm new password</label>
            <Input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button type="submit" disabled={passwordBusy}>
            {passwordBusy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
