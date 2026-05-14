"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, ContactStatus, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { toast } from "sonner";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-surface border border-border",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-amber-500/10",
  meeting:   "text-info bg-blue-500/10",
  won:       "text-success bg-green-500/10",
  lost:      "text-error bg-red-500/10",
  client:    "text-success font-bold bg-green-500/10",
};

export default function LeadsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterStatus, setFilterStatus] = useState<ContactStatus | "all">("all");
  const [filterBrand, setFilterBrand] = useState("");
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  async function load() {
    const params: Record<string, string> = {};
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterBrand) params.brand_id = filterBrand;
    const r = await getContacts(params);
    setContacts(r.data ?? []);
  }

  useEffect(() => { load(); }, [filterStatus, filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands")); }, []);

  function brandName(id: string | null) {
    if (!id) return "—";
    return brands.find(b => b.id === id)?.name ?? "—";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Leads</h1>
          <p className="text-sm text-text-muted mt-1">Track and manage your prospects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <Link href="/dashboard/leads/discover" className="bg-surface border border-border text-text-muted px-4 py-2 rounded-lg text-sm font-medium hover:border-primary hover:text-text transition-colors">
            Find Leads
          </Link>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Contact
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterStatus("all")} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterStatus === "all" ? "bg-primary text-white" : "bg-surface text-text-muted border border-border hover:border-primary"}`}>
          All
        </button>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${filterStatus === s ? "bg-primary text-white" : "bg-surface text-text-muted border border-border hover:border-primary"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">No contacts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-left px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} onClick={() => setSlideOver({ contactId: c.id, mode: "view" })} className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                  <td className="px-4 py-3 text-text-muted">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{c.role ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[c.status as ContactStatus]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{brandName(c.brand_id)}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {slideOver && (
        <ContactSlideOver
          contactId={slideOver.contactId}
          mode={slideOver.mode}
          onClose={() => setSlideOver(null)}
          onUpdated={updated => { load(); setSlideOver({ contactId: updated.id, mode: "view" }); }}
          onCreated={() => { load(); setSlideOver(null); }}
        />
      )}
    </div>
  );
}