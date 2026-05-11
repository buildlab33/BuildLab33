"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }

export default function ClientsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  async function load() {
    const params: Record<string, string> = { status: "client" };
    if (filterBrand) params.brand_id = filterBrand;
    const r = await getContacts(params);
    setContacts(r.data ?? []);
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data ?? [])).catch(() => {}); }, []);

  function brandName(id: string | null) {
    if (!id) return "—";
    return brands.find(b => b.id === id)?.name ?? "—";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Clients</h1>
          <p className="text-sm text-text-muted mt-1">Your active client relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Client
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Email</th>
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
                  <td className="px-4 py-3 text-text-muted">{c.email ?? "—"}</td>
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
          initialStatus="client"
          onClose={() => setSlideOver(null)}
          onUpdated={updated => { load(); setSlideOver({ contactId: updated.id, mode: "view" }); }}
          onCreated={() => { load(); setSlideOver(null); }}
        />
      )}
    </div>
  );
}
