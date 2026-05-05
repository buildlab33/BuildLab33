"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { checkPasswordPolicy, isPasswordValid } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const checks = checkPasswordPolicy(password);
  const valid = isPasswordValid(password) && password === confirm;

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { setError("Please fix the issues above"); return; }
    setError("");
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Reset failed. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-6" />
        <h1 className="text-xl font-bold text-text-primary mb-2">Password updated</h1>
        <p className="text-sm text-text-muted mb-6">You can now sign in with your new password.</p>
        <Button onClick={() => router.push("/login")} className="w-full">Back to login</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary">Set new password</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {password && (
                <ul className="mt-2 space-y-1">
                  {checks.map((c) => (
                    <li key={c.id} className={`text-xs flex items-center gap-1.5 ${c.pass ? "text-success" : "text-error"}`}>
                      <span>{c.pass ? "✓" : "✗"}</span>
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                error={confirm.length > 0 && password !== confirm}
                required
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-error mt-1">Passwords do not match</p>
              )}
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <Button type="submit" disabled={loading || !valid} className="w-full">
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-text-muted text-sm">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
