"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvite, acceptInviteCode, checkUsername, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { checkPasswordPolicy, isPasswordValid } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const code = searchParams.get("code") ?? "";
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = checkPasswordPolicy(password);
  const allValid =
    name.trim().length > 0 &&
    username.length >= 3 &&
    usernameAvailable === true &&
    isPasswordValid(password) &&
    password === confirm;

  useEffect(() => {
    if (!token && !code) router.push("/login");
  }, [token, code, router]);

  const checkAvailability = useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) { setUsernameAvailable(null); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) { setUsernameAvailable(false); return; }
      try {
        const res = await checkUsername(value);
        setUsernameAvailable(res.data.available);
      } catch {
        setUsernameAvailable(null);
      }
    }, 400),
    []
  );

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameAvailable(null);
    checkAvailability(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setError("");
    setLoading(true);
    try {
      const res = code
        ? await acceptInviteCode(code, username, password, name)
        : await acceptInvite(token, username, password, name);
      const { access_token, refresh_token } = res.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to create account. The invite link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary">Set up your account</h1>
        <p className="text-xs text-text-muted mt-1">Choose a username and password to get started</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                error={usernameAvailable === false}
                required
              />
              {username.length >= 3 && (
                <p className={`text-xs mt-1 ${usernameAvailable === true ? "text-success" : usernameAvailable === false ? "text-error" : "text-text-muted"}`}>
                  {usernameAvailable === true ? "✓ Available" : usernameAvailable === false ? "✗ Not available" : "Checking..."}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
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
                    <li key={c.id} className={`text-xs flex items-center gap-1.5 ${c.pass ? "text-success" : "text-text-muted"}`}>
                      <span>{c.pass ? "✓" : "○"}</span>
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
            <Button type="submit" disabled={loading || !allValid} className="w-full">
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-text-muted text-sm">Loading...</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
