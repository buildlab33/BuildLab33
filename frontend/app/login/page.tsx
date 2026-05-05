"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      const data = res.data;

      // 2FA required
      if (data.requires_2fa) {
        sessionStorage.setItem("2fa_temp_token", data.temp_token);
        router.push("/login/2fa");
        return;
      }

      // Normal login — fetch user profile
      const { access_token, refresh_token } = data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Invalid username or password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">COP Platform</h1>
          <p className="text-xs text-text-muted mt-1">Sign in to continue</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-text-active transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
