"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ActivityChannel, ActivityItem, ContactItem, getContacts, logActivity } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, X, Send } from "lucide-react";

interface Brand { id: string; name: string }
interface FlatActivity extends ActivityItem {
  contact: ContactItem;
}

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-info/15 text-info",
  call:     "bg-warning/15 text-warning",
  meeting:  "bg-success/15 text-success",
  other:    "bg-elevated text-text-muted",
};
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

export default function OutreachPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewContactId, setViewContactId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState(false);
  const [logStep, setLogStep] = useState<1 | 2>(1);
  const [logContactId, setLogContactId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState(today);
  const [logChannel, setLogChannel] = useState<ActivityChannel>("linkedin");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => { document.title = "Outreach · COP Platform"; }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = { include_activities: true };
      if (filterBrand) params.brand_id = filterBrand;
      const r = await getContacts(params as Parameters<typeof getContacts>[0]);
      setContacts(r.data ?? []);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands")); }, []);

  // ESC to close log modal
  useEffect(() => {
    if (!logModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLogModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logModal]);

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
    <div className="space-y-6">
      <PageHeader
        title="Outreach"
        subtitle="Activity log across all contacts"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={filterBrand}
                onChange={e => setFilterBrand(e.target.value)}
                className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">All brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
            <Button onClick={openLogModal}>Log Activity</Button>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[140px]" />
              <Skeleton className="h-4 flex-1 max-w-[120px]" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Send size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
          <p className="text-sm text-text-muted">No activities logged yet.</p>
          <Button className="mt-4" onClick={openLogModal}>Log your first activity</Button>
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
                <tr
                  key={a.id}
                  onClick={() => setViewContactId(a.contact.id)}
                  className="border-b border-border last:border-0 hover:bg-elevated transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">{a.activity_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{a.contact.name}</td>
                  <td className="px-4 py-3 text-text-muted">{a.contact.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted max-w-xs truncate">{a.notes.length > 80 ? a.notes.slice(0, 80) + "…" : a.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setLogModal(false); }}
        >
          <div className="bg-surface rounded-xl border border-border w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-text-primary">{logStep === 1 ? "Select Contact" : "Log Activity"}</h2>
              <button
                onClick={() => setLogModal(false)}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              ><X size={15} /></button>
            </div>
            {logStep === 1 ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Contact</label>
                  <div className="relative">
                    <select
                      value={logContactId}
                      onChange={e => setLogContactId(e.target.value)}
                      className="w-full appearance-none bg-elevated border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="">Select a contact…</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  </div>
                </div>
                {!logContactId && (
                  <p className="text-xs text-text-muted -mt-1">Select a contact to continue</p>
                )}
                <Button onClick={() => logContactId && setLogStep(2)} disabled={!logContactId} className="w-full">
                  Next
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={e => setLogDate(e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Channel</label>
                    <div className="relative">
                      <select
                        value={logChannel}
                        onChange={e => setLogChannel(e.target.value as ActivityChannel)}
                        className="w-full appearance-none bg-elevated border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
                      >
                        {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Notes</label>
                  <textarea
                    value={logNotes}
                    onChange={e => setLogNotes(e.target.value)}
                    rows={3}
                    placeholder="What happened?"
                    className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setLogStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={submitLog} disabled={logSaving || !logNotes.trim()} className="flex-1">
                    {logSaving ? "Saving…" : "Log Activity"}
                  </Button>
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
