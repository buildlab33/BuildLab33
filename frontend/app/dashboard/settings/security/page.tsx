"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { setup2FA, enable2FA, disable2FA } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

export default function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

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
      window.location.reload();
    } catch {
      toast.error("Invalid code — check your authenticator app");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await disable2FA(disableCode);
      toast.success("2FA disabled");
      setShowDisable(false);
      setDisableCode("");
      window.location.reload();
    } catch {
      toast.error("Invalid code");
    } finally {
      setLoading(false);
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
                <span className="text-xs font-semibold text-success">● Enabled</span>
                <span className="text-xs text-text-muted">Your account is protected with 2FA</span>
              </div>
              {!showDisable ? (
                <Button variant="danger" onClick={() => setShowDisable(true)}>
                  Disable 2FA
                </Button>
              ) : (
                <form onSubmit={handleDisable} className="space-y-3">
                  <p className="text-xs text-text-muted">
                    Enter your current authenticator code to disable 2FA.
                  </p>
                  <div>
                    <Label htmlFor="disable-code">Authenticator code</Label>
                    <Input
                      id="disable-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" disabled={loading || disableCode.length !== 6}>
                      {loading ? "Disabling..." : "Confirm disable"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
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
                  <Input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>
                <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                  {loading ? "Verifying..." : "Enable 2FA"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Add an extra layer of security. You&apos;ll need Google Authenticator, Authy, or any TOTP app.
              </p>
              <Button onClick={handleSetup} disabled={loading}>
                {loading ? "Setting up..." : "Set up 2FA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
