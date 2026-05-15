"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login2FA, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function TwoFAPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Two-factor authentication · COP Platform";
    const token = sessionStorage.getItem("2fa_temp_token");
    if (!token) router.push("/login");
    else inputRef.current?.focus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const tempToken = sessionStorage.getItem("2fa_temp_token") ?? "";
    try {
      await login2FA(tempToken, code);
      sessionStorage.removeItem("2fa_temp_token");
      const meRes = await getMe();
      setAuth(meRes.data);
      router.push("/dashboard");
    } catch {
      setError("Invalid code. Check your authenticator app and try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem("2fa_temp_token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Two-Factor Authentication</h1>
          <p className="text-xs text-text-muted mt-1">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Authentication Code</Label>
                <input
                  ref={inputRef}
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  required
                  className="w-full min-h-[56px] rounded-md border border-border bg-surface text-text-primary text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:border-primary"
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                {loading ? "Verifying..." : "Verify"}
              </Button>

              {!showHelp ? (
                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  className="block w-full text-center text-xs text-text-muted hover:text-text-active transition-colors cursor-pointer"
                >
                  Lost access to your authenticator?
                </button>
              ) : (
                <div className="bg-elevated border border-border rounded-md p-3 text-xs text-text-secondary leading-relaxed">
                  Contact your workspace admin to reset 2FA on your account. They can disable it from the team settings.
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-xs text-text-muted hover:text-text-active transition-colors cursor-pointer"
                >
                  Back to login
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
