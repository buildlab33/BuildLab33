"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";
import {
  getUsers, inviteUser, createUser, generateInviteCode,
  changeUserRole, disableUser, resendInvite,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/toast";
import { UserPlus, Copy, RefreshCw, Ban, ChevronDown, Search } from "lucide-react";

interface UserItem {
  id: string; name: string; email: string; username: string | null;
  role: string; status: string; created_at: string;
}

const SELECT_CLASS = "w-full appearance-none rounded-md border border-border bg-surface text-text-primary text-sm px-3 py-2 pr-9 focus:outline-none focus:border-primary cursor-pointer";

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Email invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  // Direct create
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Invite code
  const [codeRole, setCodeRole] = useState("user");
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Action loading + confirms
  const [resending, setResending] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<UserItem | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserItem; nextRole: string } | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  useEffect(() => { document.title = "Team · Settings"; }, []);

  useEffect(() => {
    getUsers()
      .then((r) => setUsers(r.data))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const reload = () =>
    getUsers().then((r) => setUsers(r.data)).catch(() => {});

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleInvite = async () => {
    setInviting(true);
    try {
      await inviteUser(inviteEmail, inviteRole);
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to send invite");
    } finally { setInviting(false); }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createUser({ name: createName, email: createEmail, username: createUsername, password: createPassword, role: createRole });
      toast.success(`${createName} created`);
      setCreateName(""); setCreateEmail(""); setCreateUsername(""); setCreatePassword("");
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to create user");
    } finally { setCreating(false); }
  };

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await generateInviteCode(codeRole);
      setGeneratedCode(res.data);
    } catch { toast.error("Failed to generate code"); }
    finally { setGeneratingCode(false); }
  };

  const handleResend = async (uid: string) => {
    setResending(uid);
    try {
      await resendInvite(uid);
      toast.success("Invite resent");
    } catch {
      toast.error("Failed to resend invite");
    } finally {
      setResending(null);
    }
  };

  const handleConfirmDisable = async () => {
    if (!disableTarget) return;
    const target = disableTarget;
    setDisableTarget(null);
    setDisabling(true);
    try {
      await disableUser(target.id);
      toast.success(`${target.name} disabled`);
      reload();
    } catch {
      toast.error("Failed to disable user");
    } finally {
      setDisabling(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    const { user: target, nextRole } = roleChangeTarget;
    setRoleChangeTarget(null);
    setChangingRole(true);
    try {
      await changeUserRole(target.id, nextRole);
      toast.success(`${target.name} is now ${nextRole}`);
      reload();
    } catch {
      toast.error("Failed to change role");
    } finally {
      setChangingRole(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge variant="outline" className="text-success border-success/30 text-xs">Active</Badge>;
    if (status === "invited") return <Badge variant="outline" className="text-warning border-warning/30 text-xs">Invited</Badge>;
    return <Badge variant="outline" className="text-error border-error/30 text-xs">Disabled</Badge>;
  };

  const initialColor = (name: string) => {
    const colors = ["bg-primary", "bg-info", "bg-warning", "bg-success", "bg-error"];
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (user?.role !== "super_admin") return (
    <div>
      <PageHeader title="Team & Users" subtitle="Manage workspace members" />
      <p className="text-sm text-text-muted">Access denied — super admin only.</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Team & Users" subtitle="Manage workspace members, roles, and invitations" />

      <div className="space-y-4 max-w-2xl">
        {/* User list */}
        <Card>
          <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, username…"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <Skeleton className="w-8 h-8 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                {users.length === 0 ? "No users yet." : "No users match your search."}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className={`w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${initialColor(u.name)}`}>
                      {(u.name[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                      <p className="text-xs text-text-muted truncate">{u.email}</p>
                    </div>
                    {statusBadge(u.status)}
                    <Badge variant="outline" className="text-xs capitalize">{u.role.replace("_", " ")}</Badge>
                    {u.status === "active" && u.role !== "super_admin" && (
                      <div className="flex gap-1">
                        <div className="relative">
                          <select
                            value={u.role}
                            onChange={(e) => setRoleChangeTarget({ user: u, nextRole: e.target.value })}
                            disabled={changingRole}
                            className="text-xs rounded-md border border-border bg-surface text-text-primary px-2 pr-6 py-1 appearance-none focus:outline-none cursor-pointer"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted" />
                        </div>
                        <button
                          onClick={() => setDisableTarget(u)}
                          aria-label={`Disable ${u.name}`}
                          title="Disable user"
                          disabled={disabling}
                          className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-error hover:border-error/30 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Ban size={13} />
                        </button>
                      </div>
                    )}
                    {u.status === "invited" && (
                      <button
                        onClick={() => handleResend(u.id)}
                        disabled={resending === u.id}
                        aria-label="Resend invite"
                        title="Resend invite"
                        className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw size={13} className={resending === u.id ? "animate-spin" : ""} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email invite */}
        <Card>
          <CardHeader><CardTitle>Invite by Email</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <div className="relative">
                <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={SELECT_CLASS}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
            <Button className="w-full" disabled={inviting || !inviteEmail} onClick={handleInvite}>
              <UserPlus size={14} />
              {inviting ? "Sending…" : "Send Invite"}
            </Button>
          </CardContent>
        </Card>

        {/* Direct creation */}
        <Card>
          <CardHeader><CardTitle>Create Account Directly</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-name">Full name</Label>
                <Input id="c-name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="c-username">Username</Label>
                <Input id="c-username" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="c-password">Temporary password</Label>
              <Input id="c-password" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="c-role">Role</Label>
              <div className="relative">
                <select id="c-role" value={createRole} onChange={(e) => setCreateRole(e.target.value)} className={SELECT_CLASS}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
            <Button className="w-full" disabled={creating || !createName || !createEmail || !createUsername || !createPassword} onClick={handleCreate}>
              {creating ? "Creating…" : "Create Account"}
            </Button>
          </CardContent>
        </Card>

        {/* Invite code */}
        <Card>
          <CardHeader><CardTitle>Generate Invite Code</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="code-role">Role for code users</Label>
              <div className="relative">
                <select id="code-role" value={codeRole} onChange={(e) => setCodeRole(e.target.value)} className={SELECT_CLASS}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
            <Button className="w-full" variant="ghost" disabled={generatingCode} onClick={handleGenerateCode}>
              {generatingCode ? "Generating…" : "Generate Code"}
            </Button>
            {generatedCode && (
              <>
                <div className="flex items-center gap-2 p-3 bg-elevated rounded-md border border-border">
                  <code className="flex-1 text-sm font-mono text-text-active tracking-widest">{generatedCode.code}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedCode.code); toast.success("Code copied"); }}
                    aria-label="Copy code"
                    className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <p className="text-xs text-text-muted">
                  Expires {new Date(generatedCode.expires_at).toLocaleDateString()} at {new Date(generatedCode.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Single use, 7 days.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        open={!!disableTarget}
        title={disableTarget ? `Disable ${disableTarget.name}?` : ""}
        description="The user will no longer be able to sign in. You can restore access later by contacting support."
        confirmLabel="Disable user"
        destructive
        loading={disabling}
        onConfirm={handleConfirmDisable}
        onCancel={() => setDisableTarget(null)}
      />

      <ConfirmModal
        open={!!roleChangeTarget}
        title={roleChangeTarget ? `Change ${roleChangeTarget.user.name}'s role?` : ""}
        description={roleChangeTarget ? `Their role will change from "${roleChangeTarget.user.role}" to "${roleChangeTarget.nextRole}". ${roleChangeTarget.nextRole === "admin" ? "Admins can create/edit brands and approve posts." : "Users can create drafts but not approve them."}` : ""}
        confirmLabel="Change role"
        loading={changingRole}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setRoleChangeTarget(null)}
      />
    </div>
  );
}
