"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { setup2FA, enable2FA, disable2FA, logoutAll, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/toast";
import { Loader2, ShieldCheck } from "lucide-react";

export default function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const disableInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "Security · Settings"; }, []);

  useEffect(() => {
    if (setupData) codeInputRef.current?.focus();
  }, [setupData]);

  useEffect(() => {
    if (showDisable) disableInputRef.current?.focus();
  }, [showDisable]);

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setAuth(me.data);
    } catch { /* silent */ }
  };

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await setup2FA();
      setSetupData(res.data);
    } catch {
      toast.error("Failed to start 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await enable2FA(code);
      toast.success("2FA enabled successfully");
      setSetupData(null);
      setCode("");
      await refreshUser();
    } catch {
      toast.error("Invalid code — check your authenticator app");
      setCode("");
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDisable = async () => {
    setConfirmDisable(false);
    setLoading(true);
    try {
      await disable2FA(disableCode);
      toast.success("2FA disabled");
      setShowDisable(false);
      setDisableCode("");
      await refreshUser();
    } catch {
      toast.error("Invalid code");
      setDisableCode("");
      disableInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    setConfirmLogoutAll(false);
    setLoggingOut(true);
    try {
      await logoutAll();
      toast.success("All other devices have been logged out");
    } catch {
      toast.error("Failed to log out other devices");
    } finally {
      setLoggingOut(false);
    }
  };

  const totpEnabled = user?.totp_enabled ?? false;

  return (
    <div>
      <PageHeader title="Security" subtitle="Manage two-factor authentication and sessions" />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpEnabled ? (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-success" />
                <span className="text-xs font-semibold text-success">Enabled</span>
                <span className="text-xs text-text-muted">Your account is protected with 2FA</span>
              </div>
              {!showDisable ? (
                <Button variant="danger" onClick={() => setShowDisable(true)}>
                  Disable 2FA
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-muted">
                    Enter your current authenticator code to disable 2FA.
                  </p>
                  <div>
                    <Label htmlFor="disable-code">Authenticator code</Label>
                    <input
                      ref={disableInputRef}
                      id="disable-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      className="w-full min-h-[52px] rounded-md border border-border bg-surface text-text-primary text-center text-xl font-mono tracking-[0.4em] focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      disabled={loading || disableCode.length !== 6}
                      onClick={() => setConfirmDisable(true)}
                    >
                      {loading ? "Disabling…" : "Confirm disable"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowDisable(false); setDisableCode(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : setupData ? (
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">
                1. Scan this QR code with Google Authenticator or Authy.
              </p>
              <div className="bg-white p-3 rounded-lg inline-block">
                <QRCodeSVG value={setupData.otpauth_uri} size={180} />
              </div>
              <p className="text-xs text-text-muted">
                Can&apos;t scan? Enter this code manually:
              </p>
              <code className="text-xs font-mono bg-elevated px-3 py-2 rounded-md block text-text-active break-all">
                {setupData.secret}
              </code>
              <form onSubmit={handleEnable} className="space-y-3">
                <p className="text-xs text-text-secondary">
                  2. Enter the 6-digit code from your app to confirm.
                </p>
                <div>
                  <Label htmlFor="totp-code">Authentication code</Label>
                  <input
                    ref={codeInputRef}
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="w-full min-h-[52px] rounded-md border border-border bg-surface text-text-primary text-center text-xl font-mono tracking-[0.4em] focus:outline-none focus:border-primary"
                  />
                </div>
                <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : "Enable 2FA"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Add an extra layer of security. You&apos;ll need Google Authenticator, Authy, or any TOTP app.
              </p>
              <Button onClick={handleSetup} disabled={loading}>
                {loading ? "Setting up…" : "Set up 2FA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-lg mt-4">
        <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-text-secondary">
            Log out all other devices and browsers where your account is currently signed in.
          </p>
          <Button variant="danger" disabled={loggingOut} onClick={() => setConfirmLogoutAll(true)}>
            {loggingOut ? "Logging out…" : "Log out all other devices"}
          </Button>
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmDisable}
        title="Disable two-factor authentication?"
        description="Your account will only require a password to sign in. This significantly reduces account security."
        confirmLabel="Disable 2FA"
        destructive
        loading={loading}
        onConfirm={handleConfirmDisable}
        onCancel={() => setConfirmDisable(false)}
      />

      <ConfirmModal
        open={confirmLogoutAll}
        title="Log out all other devices?"
        description="Other browsers and devices currently signed in will be logged out and will need to sign in again."
        confirmLabel="Log out everywhere else"
        destructive
        loading={loggingOut}
        onConfirm={handleLogoutAll}
        onCancel={() => setConfirmLogoutAll(false)}
      />
    </div>
  );
}
