"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login2FA, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function TwoFAPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("2fa_temp_token");
    if (!token) router.push("/login");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const tempToken = sessionStorage.getItem("2fa_temp_token") ?? "";
    try {
      const res = await login2FA(tempToken, code);
      const { access_token, refresh_token } = res.data;
      sessionStorage.removeItem("2fa_temp_token");
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid code. Check your authenticator app and try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
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
                <Input
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
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-xs text-text-muted hover:text-text-active transition-colors"
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
