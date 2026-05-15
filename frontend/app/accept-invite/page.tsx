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
import { Eye, EyeOff } from "lucide-react";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    document.title = "Create account · COP Platform";
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
      if (code) {
        await acceptInviteCode(code, username, password, name);
      } else {
        await acceptInvite(token, username, password, name);
      }
      const meRes = await getMe();
      setAuth(meRes.data);
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
        <Logo />
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
                autoComplete="name"
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
            <Button type="submit" disabled={loading || !allValid} className="w-full">
              {loading ? "Creating account..." : "Create account"}
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
        <div className="h-5 w-40 bg-elevated rounded mx-auto animate-pulse" />
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-10 bg-elevated rounded animate-pulse" />
          <div className="h-11 bg-elevated rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <Suspense fallback={<FallbackCard />}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
