"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, ContactStatus, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Search, Users } from "lucide-react";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-elevated border border-border",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-warning/10",
  meeting:   "text-info bg-info/10",
  won:       "text-success bg-success/10",
  lost:      "text-error bg-error/10",
  client:    "text-success font-bold bg-success/10",
};

export default function LeadsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterStatus, setFilterStatus] = useState<ContactStatus | "all">("all");
  const [filterBrand, setFilterBrand] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  useEffect(() => { document.title = "Leads · COP Platform"; }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterBrand) params.brand_id = filterBrand;
      const r = await getContacts(params);
      setContacts(r.data ?? []);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands")); }, []);

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
      (c.role ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Track and manage your prospects"
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
            <Link href="/dashboard/leads/discover">
              <Button variant="ghost">Find Leads</Button>
            </Link>
            <Button onClick={() => setSlideOver({ contactId: null, mode: "create" })}>
              Add Contact
            </Button>
          </div>
        }
      />

      {/* Search + status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, role…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer border ${
              filterStatus === "all"
                ? "border-primary bg-primary-muted text-text-active"
                : "border-border bg-surface text-text-muted hover:border-elevated hover:text-text-secondary"
            }`}
          >All</button>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer border ${
                filterStatus === s
                  ? "border-primary bg-primary-muted text-text-active"
                  : "border-border bg-surface text-text-muted hover:border-elevated hover:text-text-secondary"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <Skeleton className="h-4 flex-1 max-w-[160px]" />
                <Skeleton className="h-4 flex-1 max-w-[120px]" />
                <Skeleton className="h-4 flex-1 max-w-[100px]" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
            <p className="text-sm text-text-muted">
              {contacts.length === 0 ? "No contacts yet." : "No contacts match your filters."}
            </p>
            {contacts.length === 0 && (
              <Link href="/dashboard/leads/discover" className="inline-block mt-4">
                <Button>Find your first leads</Button>
              </Link>
            )}
          </div>
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
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSlideOver({ contactId: c.id, mode: "view" })}
                  className="border-b border-border last:border-0 hover:bg-elevated transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
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
