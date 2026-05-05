"use client";
import { useEffect, useState } from "react";
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
import { toast } from "@/components/ui/toast";
import { UserPlus, Copy, RefreshCw, Ban } from "lucide-react";

interface UserItem {
  id: string; name: string; email: string; username: string | null;
  role: string; status: string; created_at: string;
}

const SELECT_STYLE = "w-full rounded-md border border-border bg-surface text-text-primary text-sm px-3 py-2 pr-8 focus:outline-none focus:border-border-active appearance-none";
const SELECT_ARROW = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat" as const,
  backgroundPosition: "right 10px center",
};

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    getUsers()
      .then((r) => setUsers(r.data))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const reload = () =>
    getUsers().then((r) => setUsers(r.data)).catch(() => {});

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

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge variant="outline" className="text-success border-success/30 text-xs">Active</Badge>;
    if (status === "invited") return <Badge variant="outline" className="text-warning border-warning/30 text-xs">Invited</Badge>;
    return <Badge variant="outline" className="text-error border-error/30 text-xs">Disabled</Badge>;
  };

  if (user?.role !== "super_admin") return <p className="text-sm text-text-muted">Access denied.</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* User list */}
      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-text-muted">Loading...</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center text-white text-xs font-bold gradient-brand">
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
                      <select
                        value={u.role}
                        onChange={async (e) => { await changeUserRole(u.id, e.target.value); reload(); }}
                        className="text-xs rounded-md border border-border bg-surface text-text-primary px-2 py-1 appearance-none focus:outline-none"
                        style={{ backgroundImage: SELECT_ARROW.backgroundImage, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={async () => { await disableUser(u.id); reload(); }}
                        className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-error hover:border-error/30 transition-colors"
                        title="Disable user"
                      >
                        <Ban size={13} />
                      </button>
                    </div>
                  )}
                  {u.status === "invited" && (
                    <button
                      onClick={async () => { await resendInvite(u.id); toast.success("Invite resent"); }}
                      className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary transition-colors"
                      title="Resend invite"
                    >
                      <RefreshCw size={13} />
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
            <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={SELECT_STYLE} style={SELECT_ARROW}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button className="w-full" disabled={inviting || !inviteEmail} onClick={handleInvite}>
            <UserPlus className="w-4 h-4 mr-2" />
            {inviting ? "Sending..." : "Send Invite"}
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
            <Input id="c-email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-password">Temporary password</Label>
            <Input id="c-password" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-role">Role</Label>
            <select id="c-role" value={createRole} onChange={(e) => setCreateRole(e.target.value)} className={SELECT_STYLE} style={SELECT_ARROW}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button className="w-full" disabled={creating || !createName || !createEmail || !createUsername || !createPassword} onClick={handleCreate}>
            {creating ? "Creating..." : "Create Account"}
          </Button>
        </CardContent>
      </Card>

      {/* Invite code */}
      <Card>
        <CardHeader><CardTitle>Generate Invite Code</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="code-role">Role for code users</Label>
            <select id="code-role" value={codeRole} onChange={(e) => setCodeRole(e.target.value)} className={SELECT_STYLE} style={SELECT_ARROW}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button className="w-full" variant="ghost" disabled={generatingCode} onClick={handleGenerateCode}>
            {generatingCode ? "Generating..." : "Generate Code"}
          </Button>
          {generatedCode && (
            <div className="flex items-center gap-2 p-3 bg-elevated rounded-md border border-border">
              <code className="flex-1 text-sm font-mono text-text-active tracking-widest">{generatedCode.code}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(generatedCode.code); toast.success("Code copied"); }}
                className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary transition-colors"
              >
                <Copy size={13} />
              </button>
            </div>
          )}
          {generatedCode && (
            <p className="text-xs text-text-muted">
              Expires: {new Date(generatedCode.expires_at).toLocaleDateString()}. Single use, 7 days.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
