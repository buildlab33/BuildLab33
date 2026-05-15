"use client";
import { useEffect, useMemo, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ChevronDown, Search, UserCheck } from "lucide-react";

interface Brand { id: string; name: string }

export default function ClientsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  useEffect(() => { document.title = "Clients · COP Platform"; }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { status: "client" };
      if (filterBrand) params.brand_id = filterBrand;
      const r = await getContacts(params);
      setContacts(r.data ?? []);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => {}); }, []);

  function brandName(id: string | null) {
    if (!id) return "—";
    return brands.find(b => b.id === id)?.name ?? "—";
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Your active client relationships"
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
            <Button onClick={() => setSlideOver({ contactId: null, mode: "create" })}>
              Add Client
            </Button>
          </div>
        }
      />

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, email…"
          className="pl-9"
        />
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <Skeleton className="h-4 flex-1 max-w-[160px]" />
                <Skeleton className="h-4 flex-1 max-w-[120px]" />
                <Skeleton className="h-4 flex-1 max-w-[100px]" />
                <Skeleton className="h-4 flex-1 max-w-[160px]" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
            <p className="text-sm text-text-muted">
              {contacts.length === 0 ? "No clients yet." : "No clients match your search."}
            </p>
            {contacts.length === 0 && (
              <Button className="mt-4" onClick={() => setSlideOver({ contactId: null, mode: "create" })}>
                Add your first client
              </Button>
            )}
          </div>
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
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSlideOver({ contactId: c.id, mode: "view" })}
                  className="border-b border-border last:border-0 hover:bg-elevated transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
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
