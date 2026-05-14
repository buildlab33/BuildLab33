"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ActivityChannel, ActivityItem, ContactItem, getContacts, logActivity } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { toast } from "sonner";

interface Brand { id: string; name: string }
interface FlatActivity extends ActivityItem {
  contact: ContactItem;
}

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-blue-500/15 text-blue-400",
  call:     "bg-amber-500/15 text-amber-400",
  meeting:  "bg-green-500/15 text-green-400",
  other:    "bg-surface text-text-muted",
};
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

export default function OutreachPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [viewContactId, setViewContactId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState(false);
  const [logStep, setLogStep] = useState<1 | 2>(1);
  const [logContactId, setLogContactId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState(today);
  const [logChannel, setLogChannel] = useState<ActivityChannel>("linkedin");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  async function load() {
    const params: Record<string, string | boolean> = { include_activities: true };
    if (filterBrand) params.brand_id = filterBrand;
    try {
      const r = await getContacts(params as Parameters<typeof getContacts>[0]);
      setContacts(r.data ?? []);
    } catch {
      toast.error("Failed to load contacts");
    }
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands")); }, []);

  const activities: FlatActivity[] = contacts
    .flatMap(c => (c.activities ?? []).map(a => ({ ...a, contact: c })))
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date));

  function openLogModal() {
    setLogStep(1);
    setLogContactId("");
    setLogDate(today);
    setLogChannel("linkedin");
    setLogNotes("");
    setLogModal(true);
  }

  async function submitLog() {
    if (!logContactId || !logNotes.trim()) return;
    setLogSaving(true);
    try {
      await logActivity(logContactId, { channel: logChannel, notes: logNotes, activity_date: logDate });
      await load();
      setLogModal(false);
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setLogSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Outreach</h1>
          <p className="text-sm text-text-muted mt-1">Activity log across all contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={openLogModal} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Log Activity
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center text-text-muted text-sm">
          No activities logged yet.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Channel</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(a => (
                <tr key={a.id} onClick={() => setViewContactId(a.contact.id)} className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{a.activity_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text">{a.contact.name}</td>
                  <td className="px-4 py-3 text-text-muted">{a.contact.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted max-w-xs truncate">{a.notes.length > 80 ? a.notes.slice(0, 80) + "…" : a.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onMouseDown={e => { if (e.target === e.currentTarget) setLogModal(false); }}>
          <div className="bg-background rounded-xl border border-border w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">{logStep === 1 ? "Select Contact" : "Log Activity"}</h2>
              <button onClick={() => setLogModal(false)} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
            </div>
            {logStep === 1 ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Contact</label>
                  <div className="relative">
                    <select value={logContactId} onChange={e => setLogContactId(e.target.value)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                      <option value="">Select a contact…</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                  </div>
                </div>
                <button onClick={() => logContactId && setLogStep(2)} disabled={!logContactId} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Next
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-text-muted uppercase tracking-wide">Date</label>
                    <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-text-muted uppercase tracking-wide">Channel</label>
                    <div className="relative">
                      <select value={logChannel} onChange={e => setLogChannel(e.target.value as ActivityChannel)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                        {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
                  <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={3} placeholder="What happened?" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setLogStep(1)} className="flex-1 bg-surface border border-border text-text rounded-lg py-2 text-sm font-medium hover:bg-background transition-colors">
                    Back
                  </button>
                  <button onClick={submitLog} disabled={logSaving || !logNotes.trim()} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {logSaving ? "Saving..." : "Log Activity"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewContactId && (
        <ContactSlideOver
          contactId={viewContactId}
          mode="view"
          onClose={() => setViewContactId(null)}
          onUpdated={() => { load(); }}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
