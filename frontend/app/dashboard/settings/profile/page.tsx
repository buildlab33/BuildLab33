"use client";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { updateMe, changePassword } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  function pwStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
      { score: 0, label: "", color: "" },
      { score: 1, label: "Weak", color: "bg-error" },
      { score: 2, label: "Fair", color: "bg-warning" },
      { score: 3, label: "Good", color: "bg-info" },
      { score: 4, label: "Strong", color: "bg-success" },
    ];
    return levels[score];
  }

  const strength = pwStrength(newPw);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateMe({ name, email });
      if (user) {
        setAuth(
          { ...user, name, email },
          localStorage.getItem("access_token")!,
          localStorage.getItem("refresh_token")!
        );
      }
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      await changePassword({ current_password: currentPw, new_password: newPw, confirm_password: confirmPw });
      toast.success("Password updated");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Username</Label>
            <Input value={user?.username ?? ""} disabled />
            <p className="text-xs text-text-muted mt-1">Username cannot be changed after registration.</p>
          </div>
          <Button className="w-full" disabled={savingProfile} onClick={handleSaveProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-pw">Current password</Label>
            <div className="relative">
              <Input id="current-pw" type={showCurrent ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input id="new-pw" type={showNew ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {newPw && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${strength.score >= n ? strength.color : "bg-border"}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-text-muted w-12 text-right">{strength.label}</span>
              </div>
            )}
            <p className="text-xs text-text-muted mt-1">Min 8 chars, 1 uppercase, 1 number, 1 special character.</p>
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <Button className="w-full" disabled={savingPw || !currentPw || !newPw || !confirmPw} onClick={handleChangePassword}>
            {savingPw ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
