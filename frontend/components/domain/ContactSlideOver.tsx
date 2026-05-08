"use client";
import { useEffect, useRef, useState } from "react";
import {
  ActivityChannel, ActivityItem, ContactItem, ContactStatus,
  createContact, deleteActivity, getContact, logActivity, updateContact,
} from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-surface",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-amber-500/10",
  meeting:   "text-info bg-blue-500/10",
  won:       "text-success bg-green-500/10",
  lost:      "text-error bg-red-500/10",
  client:    "text-success font-bold bg-green-500/10",
};

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-blue-500/15 text-blue-400",
  call:     "bg-amber-500/15 text-amber-400",
  meeting:  "bg-green-500/15 text-green-400",
  other:    "bg-surface text-text-muted",
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
    getBrands().then(r => setBrands(r.data ?? [])).catch(() => {});
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
    } finally {
      setActSaving(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!contactId) return;
    await deleteActivity(contactId, activityId);
    const r = await getContact(contactId);
    setContact(r.data);
  }

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 bg-black/40" onMouseDown={handleBackdropMouseDown}>
      <div className="absolute right-0 top-0 h-full w-[420px] bg-background overflow-y-auto flex flex-col shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text">{mode === "create" ? "Add Contact" : (name || "Contact")}</h2>
            {mode === "view" && (company || role) && (
              <p className="text-sm text-text-muted">{[role, company].filter(Boolean).join(" @ ")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}>{status}</span>
            )}
            <button onClick={onClose} className="text-text-muted hover:text-text transition-colors text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="p-5 border-b border-border space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Role</label>
              <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">LinkedIn URL</label>
            <input value={linkedin} onChange={e => setLinkedin(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Brand</label>
              <div className="relative">
                <select value={brandId} onChange={e => setBrandId(e.target.value)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                  <option value="">None</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Status</label>
              <div className="relative">
                <select value={status} onChange={e => setStatus(e.target.value as ContactStatus)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : mode === "create" ? "Create Contact" : "Save changes"}
          </button>
        </div>
        {mode === "view" && contact && (
          <>
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-text mb-3">Activity Log</h3>
              {contact.activities.length === 0 ? (
                <p className="text-sm text-text-muted">No activities logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {contact.activities.map((a: ActivityItem) => (
                    <div key={a.id} className="flex gap-3 items-start">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">{a.activity_date}</p>
                        <p className="text-sm text-text break-words">{a.notes}</p>
                      </div>
                      <button onClick={() => handleDeleteActivity(a.id)} className="text-text-muted hover:text-error transition-colors text-sm leading-none flex-shrink-0">&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text">Log Activity</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Date</label>
                  <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Channel</label>
                  <div className="relative">
                    <select value={actChannel} onChange={e => setActChannel(e.target.value as ActivityChannel)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                      {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
                <textarea value={actNotes} onChange={e => setActNotes(e.target.value)} rows={2} placeholder="What happened?" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
              </div>
              <button onClick={handleLogActivity} disabled={actSaving || !actNotes.trim()} className="w-full bg-surface border border-border text-text rounded-lg py-2 text-sm font-medium hover:bg-surface/80 disabled:opacity-50 transition-colors">
                {actSaving ? "Logging..." : "Log Activity"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
