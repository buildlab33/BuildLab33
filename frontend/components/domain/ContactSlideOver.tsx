"use client";
import { useEffect, useRef, useState } from "react";
import {
  ActivityChannel, ActivityItem, ContactItem, ContactStatus,
  createContact, deleteActivity, getContact, logActivity, updateContact,
} from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { X } from "lucide-react";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-elevated",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-warning/10",
  meeting:   "text-info bg-info/10",
  won:       "text-success bg-success/10",
  lost:      "text-error bg-error/10",
  client:    "text-success font-bold bg-success/10",
};

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-info/15 text-info",
  call:     "bg-warning/15 text-warning",
  meeting:  "bg-success/15 text-success",
  other:    "bg-elevated text-text-muted",
};

interface Props {
  contactId: string | null;
  mode: "view" | "create";
  initialStatus?: ContactStatus;
  onClose: () => void;
  onUpdated: (c: ContactItem) => void;
  onCreated: (c: ContactItem) => void;
}

export default function ContactSlideOver({ contactId, mode, initialStatus, onClose, onUpdated, onCreated }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [contact, setContact] = useState<ContactItem | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [status, setStatus] = useState<ContactStatus>(initialStatus ?? "lead");
  const [notes, setNotes] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [actDate, setActDate] = useState(today);
  const [actChannel, setActChannel] = useState<ActivityChannel>("linkedin");
  const [actNotes, setActNotes] = useState("");
  const [actSaving, setActSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands"));
    if (mode === "view" && contactId) {
      getContact(contactId).then(r => {
        const c = r.data;
        setContact(c);
        setName(c.name);
        setCompany(c.company ?? "");
        setRole(c.role ?? "");
        setEmail(c.email ?? "");
        setLinkedin(c.linkedin_url ?? "");
        setBrandId(c.brand_id ?? "");
        setStatus(c.status);
        setNotes(c.notes ?? "");
      }).catch(() => {
        toast.error("Failed to load contact");
        onClose();
      });
    }
  }, [contactId, mode]);

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name, company: company || null, role: role || null,
        email: email || null, linkedin_url: linkedin || null,
        brand_id: brandId || null, status, notes: notes || null,
      };
      if (mode === "create") {
        const r = await createContact(payload);
        onCreated(r.data);
      } else if (contactId) {
        const r = await updateContact(contactId, payload);
        onUpdated(r.data);
      }
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogActivity() {
    if (!contactId || !actNotes.trim()) return;
    setActSaving(true);
    try {
      await logActivity(contactId, { channel: actChannel, notes: actNotes, activity_date: actDate });
      const r = await getContact(contactId);
      setContact(r.data);
      setActNotes("");
      setActDate(today);
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setActSaving(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!contactId) return;
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    try {
      await deleteActivity(contactId, activityId);
      const r = await getContact(contactId);
      setContact(r.data);
    } catch {
      toast.error("Failed to delete activity");
    }
  }

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onMouseDown={handleBackdropMouseDown}>
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-text-primary">{mode === "create" ? "Add Contact" : (name || "Contact")}</h2>
            {mode === "view" && (company || role) && (
              <p className="text-sm text-text-muted mt-0.5">{[role, company].filter(Boolean).join(" @ ")}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {mode === "view" && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLE[status]}`}>{status}</span>
            )}
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-elevated hover:bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Contact fields */}
          <div className="px-6 py-5 border-b border-border space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Role</label>
                <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">LinkedIn URL</label>
              <input value={linkedin} onChange={e => setLinkedin(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Brand</label>
                <div className="relative">
                  <select value={brandId} onChange={e => setBrandId(e.target.value)} className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary pr-7 focus:outline-none focus:border-primary transition-colors">
                    <option value="">None</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Status</label>
                <div className="relative">
                  <select value={status} onChange={e => setStatus(e.target.value as ContactStatus)} className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary pr-7 focus:outline-none focus:border-primary transition-colors">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          {/* Activity log */}
          {mode === "view" && contact && (
            <>
              <div className="px-6 py-5 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Activity Log</h3>
                {contact.activities.length === 0 ? (
                  <p className="text-sm text-text-muted">No activities logged yet.</p>
                ) : (
                  <div className="space-y-3">
                    {contact.activities.map((a: ActivityItem) => (
                      <div key={a.id} className="flex gap-3 items-start bg-background rounded-lg p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap mt-0.5 ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-muted mb-0.5">{a.activity_date}</p>
                          <p className="text-sm text-text-primary break-words">{a.notes}</p>
                        </div>
                        <button onClick={() => handleDeleteActivity(a.id)} aria-label="Delete activity" className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-error/10 text-text-muted hover:text-error transition-colors flex-shrink-0 cursor-pointer"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">Log Activity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date</label>
                    <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Channel</label>
                    <div className="relative">
                      <select value={actChannel} onChange={e => setActChannel(e.target.value as ActivityChannel)} className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary pr-7 focus:outline-none focus:border-primary transition-colors">
                        {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Notes</label>
                  <textarea value={actNotes} onChange={e => setActNotes(e.target.value)} rows={2} placeholder="What happened?" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-elevated flex-shrink-0 flex gap-2">
          {mode === "view" && contact && (
            <button onClick={handleLogActivity} disabled={actSaving || !actNotes.trim()} className="flex-1 bg-elevated border border-border text-text-secondary rounded-lg py-2 text-sm font-medium hover:bg-border hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
              {actSaving ? "Logging..." : "Log Activity"}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
            {saving ? "Saving..." : mode === "create" ? "Create Contact" : "Save changes"}
          </button>
        </div>

      </div>
    </div>
  );
}
