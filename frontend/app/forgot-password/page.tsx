"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function Logo() {
  return (
    <div className="w-12 h-12 rounded-xl bg-primary mx-auto mb-4 flex items-center justify-center">
      <span className="text-white font-bold text-lg">C</span>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  useEffect(() => { document.title = "Reset password · COP Platform"; }, []);

  const submit = async () => {
    try {
      const res = await forgotPassword(email);
      if (res.data?.token) setDevToken(res.data.token);
    } catch {
      // Silent — no user enumeration
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await submit();
    setSubmitted(true);
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    await submit();
    setResending(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <h1 className="text-xl font-bold text-text-primary mb-2">Check your email</h1>
          <p className="text-sm text-text-muted mb-6">
            If that email is registered, we&apos;ve sent a reset link. It expires in 1 hour.
          </p>
          {devToken && process.env.NODE_ENV !== "production" && (
            <div className="bg-elevated border border-border rounded-lg p-4 mb-4 text-left">
              <p className="text-xs text-warning font-semibold mb-1">Dev mode — reset token:</p>
              <p className="text-xs text-text-secondary break-all font-mono">{devToken}</p>
              <Link
                href={`/reset-password?token=${devToken}`}
                className="text-xs text-primary hover:underline mt-2 block"
              >
                Open reset page →
              </Link>
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-xs text-text-muted hover:text-text-active transition-colors cursor-pointer disabled:opacity-50"
            >
              {resending ? "Resending..." : "Didn't get it? Resend"}
            </button>
            <Link href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo />
          <h1 className="text-xl font-bold text-text-primary">Reset your password</h1>
          <p className="text-xs text-text-muted mt-1">
            Enter the email address on your account
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <div className="text-center">
                <Link href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
                  Back to login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
