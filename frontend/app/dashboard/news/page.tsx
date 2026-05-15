"use client";
import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, RefreshCw, CheckCheck, Newspaper, Briefcase } from "lucide-react";
import { getBrands } from "@/lib/api";
import { NewsArticle, getNews } from "@/lib/news-api";
import NewsSlideOver from "@/components/domain/NewsSlideOver";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface Brand { id: string; name: string }

function readKey(brand: string) { return `news_read_${brand}`; }
function getRead(brand: string): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(readKey(brand)) ?? "[]")); } catch { return new Set(); }
}
function markRead(brand: string, url: string) {
  const set = getRead(brand);
  set.add(url);
  sessionStorage.setItem(readKey(brand), JSON.stringify([...set]));
}
function markAllRead(brand: string, urls: string[]) {
  sessionStorage.setItem(readKey(brand), JSON.stringify(urls));
}

export default function NewsFeedPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slideOver, setSlideOver] = useState<NewsArticle | null>(null);
  const [readUrls, setReadUrls] = useState<Set<string>>(new Set());

  useEffect(() => { document.title = "News Feed · COP Platform"; }, []);

  useEffect(() => {
    getBrands()
      .then(r => setBrands(r.data?.brands || []))
      .catch(() => toast.error("Failed to load brands"))
      .finally(() => setLoadingBrands(false));
  }, []);

  const fetchArticles = async (brand: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await getNews(brand);
      setArticles(r.data ?? []);
      if (isRefresh) toast.success("News refreshed");
    } catch {
      setArticles([]);
      if (isRefresh) toast.error("Failed to refresh news");
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBrand) { setArticles([]); setReadUrls(new Set()); return; }
    setReadUrls(getRead(selectedBrand));
    fetchArticles(selectedBrand);
  }, [selectedBrand]);

  const unreadCount = articles.filter((a, i) => !readUrls.has(a.url ?? String(i))).length;

  const handleMarkAllRead = () => {
    if (!selectedBrand) return;
    const allKeys = articles.map((a, i) => a.url ?? String(i));
    markAllRead(selectedBrand, allKeys);
    setReadUrls(new Set(allKeys));
    toast.success("All articles marked as read");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="News Feed"
        subtitle="Industry news matched to your brands"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
                className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Select a brand</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
            {selectedBrand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchArticles(selectedBrand, true)}
                disabled={refreshing || loading}
                aria-label="Refresh news"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
              </Button>
            )}
          </div>
        }
      />

      {/* No brands at all */}
      {!loadingBrands && brands.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Briefcase size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
          <div className="font-bold text-text-primary mb-1">No brands yet</div>
          <p className="text-sm text-text-secondary mb-4 max-w-sm mx-auto">
            Create a brand to start seeing matched industry news here.
          </p>
          <Button onClick={() => router.push("/dashboard/brands/new")}>
            Create a brand
          </Button>
        </div>
      ) : (
        <>
          {/* Subheader with counts + mark-all-read */}
          {selectedBrand && !loading && articles.length > 0 && (
            <div className="flex items-center justify-between -mt-2 px-1">
              <span className="text-xs text-text-muted">
                {articles.length} article{articles.length === 1 ? "" : "s"}
                {unreadCount > 0 && <> · <span className="text-text-primary font-semibold">{unreadCount} unread</span></>}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-text-muted hover:text-text-active transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
          )}

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {!selectedBrand ? (
              <div className="p-12 text-center">
                <Newspaper size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted">Select a brand to load its industry news.</p>
              </div>
            ) : loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 flex items-center gap-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="p-12 text-center">
                <Newspaper size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted">No articles found for this brand yet.</p>
                <p className="text-xs text-text-muted mt-1">Try refreshing or check back later.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {articles.map((article, i) => {
                  const key = article.url ?? String(i);
                  const isRead = readUrls.has(key);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        markRead(selectedBrand, key);
                        setReadUrls(prev => new Set([...prev, key]));
                        setSlideOver(article);
                      }}
                      className={`w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-elevated transition-colors cursor-pointer ${isRead ? "opacity-60" : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRead ? "bg-transparent" : "bg-primary"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isRead ? "text-text-muted font-normal" : "font-medium text-text-primary"}`}>{article.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {article.source}
                          {article.published_at
                            ? ` · ${new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : ""}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {slideOver && (
        <NewsSlideOver article={slideOver} onClose={() => setSlideOver(null)} />
      )}
    </div>
  );
}
