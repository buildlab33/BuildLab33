"use client";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";
import { NewsArticle } from "@/lib/news-api";

interface Props {
  article: NewsArticle;
  onClose: () => void;
}

export default function NewsSlideOver({ article, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  const formattedDate = (() => {
    try {
      return new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return "";
    }
  })();

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{article.source}</span>
              {formattedDate && <span className="text-xs text-text-muted">{formattedDate}</span>}
            </div>
            <h2 className="text-lg font-bold text-text leading-snug">{article.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-elevated hover:bg-border text-text-muted hover:text-text transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {article.summary && (
            <p className="text-sm text-text-secondary leading-relaxed">{article.summary}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-elevated">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Read full article
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
