"use client";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getBrands } from "@/lib/api";
import { NewsArticle, getNews } from "@/lib/news-api";
import NewsSlideOver from "@/components/domain/NewsSlideOver";
import { toast } from "sonner";

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

export default function NewsFeedPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [slideOver, setSlideOver] = useState<NewsArticle | null>(null);
  const [readUrls, setReadUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBrands().then(r => setBrands(r.data?.brands || [])).catch(() => toast.error("Failed to load brands"));
  }, []);

  useEffect(() => {
    if (!selectedBrand) { setArticles([]); setReadUrls(new Set()); return; }
    setLoading(true);
    setReadUrls(getRead(selectedBrand));
    getNews(selectedBrand)
      .then(r => setArticles(r.data ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [selectedBrand]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">News Feed</h1>
          <p className="text-sm text-text-muted mt-1">Industry news matched to your brands</p>
        </div>
        <div className="relative">
          <select
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
            className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7"
          >
            <option value="">Select a brand</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {!selectedBrand ? (
          <div className="p-12 text-center text-text-muted text-sm">
            Select a brand to load its industry news.
          </div>
        ) : loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-3 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-elevated rounded w-3/4" />
                  <div className="h-3 bg-elevated rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">
            No articles found for this brand.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles.map((article, i) => {
              const isRead = readUrls.has(article.url ?? String(i));
              return (
                <button
                  key={i}
                  onClick={() => {
                    const key = article.url ?? String(i);
                    markRead(selectedBrand, key);
                    setReadUrls(prev => new Set([...prev, key]));
                    setSlideOver(article);
                  }}
                  className={`w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-background transition-colors ${isRead ? "opacity-60" : ""}`}
                >
                  {!isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${isRead ? "" : ""}`}>
                    <p className={`text-sm truncate ${isRead ? "text-text-muted font-normal" : "font-medium text-text"}`}>{article.title}</p>
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

      {slideOver && (
        <NewsSlideOver article={slideOver} onClose={() => setSlideOver(null)} />
      )}
    </div>
  );
}
