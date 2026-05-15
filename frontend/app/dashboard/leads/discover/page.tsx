"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { getBrands, BrandPublic } from "@/lib/api";
import { discoverLeads, LeadSuggestion } from "@/lib/leads-api";
import { getContacts, createContact, ContactItem } from "@/lib/contacts-api";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildNotes(lead: LeadSuggestion, opener: string): string {
  const raw = `Platform: ${lead.platform} | Handle: ${lead.handle} | Niche: ${lead.niche} | Audience: ${lead.audience_size} | Fit: ${lead.fit_score}/10\n\nOutreach opener:\n${opener}`;
  return raw.slice(0, 5000);
}

function sessionKey(brandId: string) {
  return `leads_discover_${brandId}`;
}

function fitScoreClass(score: number): string {
  if (score >= 8) return "bg-success/10 text-success";
  if (score >= 5) return "bg-warning/10 text-warning";
  return "bg-error/10 text-error";
}

function platformBadgeClass(platform: string): string {
  const map: Record<string, string> = {
    instagram: "bg-pink-500/15 text-pink-400",
    youtube: "bg-red-500/15 text-red-400",
    linkedin: "bg-blue-500/15 text-blue-400",
    blog: "bg-purple-500/15 text-purple-400",
    podcast: "bg-indigo-500/15 text-indigo-400",
    twitter: "bg-sky-500/15 text-sky-400",
  };
  return map[platform] ?? "bg-elevated text-text-muted";
}

function isDuplicate(lead: LeadSuggestion, contacts: ContactItem[]): ContactItem | null {
  const nameLower = lead.name.toLowerCase();
  const handleLower = lead.handle.toLowerCase();
  for (const c of contacts) {
    if (c.name.toLowerCase() === nameLower) return c;
    if (c.notes && c.notes.toLowerCase().includes(handleLower)) return c;
  }
  return null;
}

interface ApiError {
  response?: { status?: number };
}

function handleApiError(err: unknown) {
  const status = (err as ApiError)?.response?.status;
  if (status === 403) toast.error("You don't have access to this brand");
  else if (status === 404) toast.error("Brand not found");
  else if (status === 429) toast.error("Too many requests — wait a minute and try again");
  else if (status === 503) toast.error("AI service unavailable — try again in a moment");
  else toast.error("Failed to fetch suggestions — try again");
}

function getApiStatus(err: unknown): number | undefined {
  return (err as ApiError)?.response?.status;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = "empty" | "loading" | "results" | "completion";

interface CardState {
  lead: LeadSuggestion;
  opener: string;
  status: "idle" | "approving" | "approved" | "dismissed";
  dupContact: ContactItem | null;
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 bg-border rounded w-32" />
        <div className="h-5 bg-border rounded w-16" />
      </div>
      <div className="h-4 bg-border rounded w-24" />
      <div className="h-3 bg-border rounded w-full" />
      <div className="h-3 bg-border rounded w-4/5" />
      <div className="h-20 bg-border rounded w-full" />
      <div className="flex gap-2 pt-1">
        <div className="h-8 bg-border rounded w-24" />
        <div className="h-8 bg-border rounded w-20" />
      </div>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  card: CardState;
  onOpenerChange: (value: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
}

function LeadCard({ card, onOpenerChange, onApprove, onDismiss }: LeadCardProps) {
  const { lead, opener, status, dupContact } = card;

  if (status === "approved" || status === "dismissed") return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* Dedup warning */}
      {dupContact && (
        <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg px-3 py-2 text-xs">
          Already in CRM as <span className="font-semibold">{dupContact.status}</span>
          {dupContact.name !== lead.name ? ` (matched by handle)` : ""}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-text-primary text-base">{lead.name}</h3>
          <p className="text-text-muted text-xs mt-0.5">
            {lead.handle}
            {lead.company ? ` · ${lead.company}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformBadgeClass(lead.platform)}`}>
            {capitalize(lead.platform)}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fitScoreClass(lead.fit_score)}`}>
            {lead.fit_score}/10
          </span>
        </div>
      </div>

      {/* Niche + audience */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-elevated border border-border rounded px-2 py-0.5 text-text-muted">
          {lead.niche}
        </span>
        <span className="text-text-muted">{lead.audience_size}</span>
      </div>

      {/* Reason */}
      <p className="text-sm text-text-muted leading-relaxed">{lead.reason}</p>

      {/* Editable outreach opener */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Outreach opener
        </label>
        <textarea
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          rows={3}
          value={opener}
          onChange={(e) => onOpenerChange(e.target.value)}
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={onApprove} disabled={status === "approving"}>
          {status === "approving" ? (
            <><Loader2 size={14} className="animate-spin" /> Importing…</>
          ) : (
            "Approve"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={status === "approving"} className="text-text-muted">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadDiscoverPage() {
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [pageState, setPageState] = useState<PageState>("empty");
  const [cards, setCards] = useState<CardState[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [loadingBrands, setLoadingBrands] = useState(true);

  useEffect(() => { document.title = "Discover Leads · COP Platform"; }, []);

  useEffect(() => {
    getBrands()
      .then((res) => {
        const list: BrandPublic[] = res.data?.brands ?? res.data ?? [];
        setBrands(list);
        if (list.length > 0) setSelectedBrandId(list[0].id);
      })
      .catch(() => toast.error("Failed to load brands"))
      .finally(() => setLoadingBrands(false));
  }, []);

  // When brand changes while in results state, go back to empty
  const handleBrandChange = (id: string) => {
    setSelectedBrandId(id);
    if (pageState === "results") setPageState("empty");
  };

  const buildCards = useCallback(
    (leads: LeadSuggestion[], existingContacts: ContactItem[]): CardState[] =>
      leads.map((lead) => ({
        lead,
        opener: lead.outreach_opener,
        status: "idle",
        dupContact: isDuplicate(lead, existingContacts),
      })),
    []
  );

  const handleFindLeads = async () => {
    if (!selectedBrandId) return;

    // Check sessionStorage first
    const cached = sessionStorage.getItem(sessionKey(selectedBrandId));
    if (cached) {
      try {
        const leads: LeadSuggestion[] = JSON.parse(cached);
        setPageState("loading");
        const contactsRes = await getContacts({ brand_id: selectedBrandId });
        const existingContacts: ContactItem[] = contactsRes.data ?? [];
        setContacts(existingContacts);
        setCards(buildCards(leads, existingContacts));
        setApprovedCount(0);
        setDismissedCount(0);
        setPageState("results");
        return;
      } catch {
        // corrupt cache — fall through to API
        sessionStorage.removeItem(sessionKey(selectedBrandId));
      }
    }

    setPageState("loading");

    try {
      const [leadsRes, contactsRes] = await Promise.all([
        discoverLeads(selectedBrandId),
        getContacts({ brand_id: selectedBrandId }),
      ]);

      const leads: LeadSuggestion[] = leadsRes.data?.leads ?? [];
      const existingContacts: ContactItem[] = contactsRes.data ?? [];

      sessionStorage.setItem(sessionKey(selectedBrandId), JSON.stringify(leads));

      setContacts(existingContacts);
      setCards(buildCards(leads, existingContacts));
      setApprovedCount(0);
      setDismissedCount(0);
      setPageState("results");
    } catch (err) {
      handleApiError(err);
      setPageState("empty");
    }
  };

  const handleOpenerChange = (index: number, value: string) => {
    setCards((prev) => {
      const updated = prev.map((c, i) => (i === index ? { ...c, opener: value } : c));
      if (selectedBrandId) {
        const leads = updated.map((c) => ({ ...c.lead, outreach_opener: c.opener }));
        sessionStorage.setItem(sessionKey(selectedBrandId), JSON.stringify(leads));
      }
      return updated;
    });
  };

  const removeFromSession = (brandId: string, leadName: string) => {
    const cached = sessionStorage.getItem(sessionKey(brandId));
    if (!cached) return;
    try {
      const leads: LeadSuggestion[] = JSON.parse(cached);
      const updated = leads.filter((l) => l.name !== leadName);
      sessionStorage.setItem(sessionKey(brandId), JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleApprove = async (index: number) => {
    const card = cards[index];
    if (!card || card.status !== "idle") return;

    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: "approving" } : c))
    );

    const lead = card.lead;
    const opener = card.opener;

    const linkedinUrl =
      lead.platform === "linkedin" &&
      (lead.handle.includes("/in/") || lead.handle.startsWith("http"))
        ? lead.handle
        : null;

    try {
      await createContact({
        brand_id: selectedBrandId,
        name: lead.name,
        company: lead.company || null,
        role: `${capitalize(lead.platform)} Influencer`,
        status: "lead",
        linkedin_url: linkedinUrl,
        notes: buildNotes(lead, opener),
      });

      removeFromSession(selectedBrandId, lead.name);
      setApprovedCount((n) => n + 1);

      setCards((prev) => {
        const updatedCards = prev.map((c, i) =>
          i === index ? { ...c, status: "approved" as const } : c
        );
        const allDone = updatedCards.every(
          (c) => c.status === "approved" || c.status === "dismissed"
        );
        if (allDone) setPageState("completion");
        return updatedCards;
      });
    } catch (err) {
      const status = getApiStatus(err);
      if (status === 403) toast.error("You don't have access to this brand");
      else toast.error(`Failed to import ${lead.name} — try again`);
      setCards((prev) =>
        prev.map((c, i) => (i === index ? { ...c, status: "idle" } : c))
      );
    }
  };

  const handleDismiss = (index: number) => {
    const card = cards[index];
    if (!card || card.status !== "idle") return;

    removeFromSession(selectedBrandId, card.lead.name);
    setDismissedCount((n) => n + 1);

    setCards((prev) => {
      const updatedCards = prev.map((c, i) =>
        i === index ? { ...c, status: "dismissed" as const } : c
      );
      const allDone = updatedCards.every(
        (c) => c.status === "approved" || c.status === "dismissed"
      );
      if (allDone) setPageState("completion");
      return updatedCards;
    });
  };

  const handleFindMore = () => {
    sessionStorage.removeItem(sessionKey(selectedBrandId));
    setCards([]);
    setApprovedCount(0);
    setDismissedCount(0);
    setPageState("empty");
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  // ── Render: Empty ─────────────────────────────────────────────────────────

  if (pageState === "empty") {
    return (
      <div className="py-6">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Discover Leads</h1>
            <p className="text-text-muted text-sm mt-2">
              AI will suggest influencers and partners based on your brand&apos;s content pillars and voice
            </p>
          </div>

          {!loadingBrands && brands.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-4 text-left">
              <p className="text-sm text-text-muted leading-relaxed">
                You need at least one brand before discovering leads. Brand context helps AI suggest the right influencers and partners.
              </p>
              <Link href="/dashboard/brands/new">
                <Button>Create your first brand</Button>
              </Link>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5 text-left">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Brand
                </label>
                {loadingBrands ? (
                  <div className="h-10 bg-border rounded-lg animate-pulse" />
                ) : (
                  <div className="relative">
                    <select
                      className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary w-full focus:outline-none focus:border-primary cursor-pointer"
                      value={selectedBrandId}
                      onChange={(e) => handleBrandChange(e.target.value)}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  </div>
                )}
              </div>

              <Button
                onClick={handleFindLeads}
                disabled={!selectedBrandId || loadingBrands}
                className="w-full"
              >
                Find Leads
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Discover Leads</h1>
            <p className="text-text-muted text-sm mt-1">
              Finding influencers and partners for{" "}
              <span className="font-medium text-text-primary">{selectedBrand?.name ?? "your brand"}</span>…
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Results ───────────────────────────────────────────────────────

  if (pageState === "results") {
    const visibleCards = cards.filter(
      (c) => c.status === "idle" || c.status === "approving"
    );

    return (
      <div className="py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Discover Leads</h1>
              <p className="text-text-muted text-sm mt-1">
                {visibleCards.length} suggestion{visibleCards.length !== 1 ? "s" : ""} for{" "}
                <span className="font-medium text-text-primary">{selectedBrand?.name}</span>
              </p>
            </div>
            <div className="relative shrink-0">
              <select
                className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
                value={selectedBrandId}
                onChange={(e) => handleBrandChange(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg px-4 py-3 text-sm">
            These are AI-generated archetypes — verify details before reaching out.
          </div>

          {/* Cards grid */}
          {visibleCards.length === 0 ? (
            <p className="text-text-muted text-sm">No more suggestions to review.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map((card, index) => (
                <LeadCard
                  key={`${card.lead.handle || card.lead.name}-${index}`}
                  card={card}
                  onOpenerChange={(val) => handleOpenerChange(index, val)}
                  onApprove={() => handleApprove(index)}
                  onDismiss={() => handleDismiss(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Completion ────────────────────────────────────────────────────

  return (
    <div className="py-6">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">All done</h1>
        </div>

        <div className="bg-surface border border-border rounded-xl p-8 space-y-5">
          {approvedCount > 0 ? (
            <>
              <p className="text-text-primary text-base">
                <span className="font-semibold text-success">{approvedCount} lead{approvedCount !== 1 ? "s" : ""} imported</span>
                {dismissedCount > 0 && (
                  <span className="text-text-muted">, {dismissedCount} dismissed</span>
                )}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/dashboard/leads">
                  <Button>View in Leads</Button>
                </Link>
                <Button variant="ghost" onClick={handleFindMore}>
                  Find More
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-text-muted text-sm leading-relaxed">
                Nothing imported — try a different brand or adjust your content pillars.
              </p>
              <Button onClick={handleFindMore}>Find More</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
