"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { checkPasswordPolicy, isPasswordValid } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

function Logo() {
  return (
    <div className="w-12 h-12 rounded-xl bg-primary mx-auto mb-4 flex items-center justify-center">
      <span className="text-white font-bold text-lg">C</span>
    </div>
  );
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const checks = checkPasswordPolicy(password);
  const valid = isPasswordValid(password) && password === confirm;

  useEffect(() => {
    document.title = "Set new password · COP Platform";
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
        <Logo />
        <h1 className="text-xl font-bold text-text-primary mb-2">Password updated</h1>
        <p className="text-sm text-text-muted mb-6">You can now sign in with your new password.</p>
        <Button onClick={() => router.push("/login")} className="w-full">Back to login</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Logo />
        <h1 className="text-xl font-bold text-text-primary">Set new password</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <PasswordToggle show={showPw} onToggle={() => setShowPw(!showPw)} />
              </div>
              {password && (
                <ul className="mt-2 space-y-1">
                  {checks.map((c) => (
                    <li key={c.id} className={`text-xs flex items-center gap-1.5 ${c.pass ? "text-success" : "text-text-muted"}`}>
                      <span>{c.pass ? "✓" : "✗"}</span>
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={confirm.length > 0 && password !== confirm}
                  required
                  className="pr-10"
                />
                <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </div>
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

function FallbackCard() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Logo />
        <div className="h-5 w-32 bg-elevated rounded mx-auto animate-pulse" />
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-11 bg-elevated rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <Suspense fallback={<FallbackCard />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
