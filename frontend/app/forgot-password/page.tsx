"use client";
import { useState } from "react";
import { forgotPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.data?.token) {
        setDevToken(res.data.token);
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Still show success (no user enumeration)
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-6" />
          <h1 className="text-xl font-bold text-text-primary mb-2">Check your email</h1>
          <p className="text-sm text-text-muted mb-6">
            If that email is registered, we&apos;ve sent a reset link. It expires in 1 hour.
          </p>
          {devToken && process.env.NODE_ENV !== "production" && (
            <div className="bg-elevated border border-border rounded-lg p-4 mb-4 text-left">
              <p className="text-xs text-warning font-semibold mb-1">Dev mode — reset token:</p>
              <p className="text-xs text-text-secondary break-all font-mono">{devToken}</p>
              <a
                href={`/reset-password?token=${devToken}`}
                className="text-xs text-primary hover:underline mt-2 block"
              >
                Open reset page →
              </a>
            </div>
          )}
          <a href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
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
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <div className="text-center">
                <a href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
                  Back to login
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
