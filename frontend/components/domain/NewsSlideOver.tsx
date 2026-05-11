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
      className="fixed inset-0 z-50 bg-black/40"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="absolute right-0 top-0 h-full w-[420px] bg-background overflow-y-auto flex flex-col shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 pr-4">
            <h2 className="text-base font-semibold text-text leading-snug">{article.title}</h2>
            <p className="text-xs text-text-muted mt-1">
              {article.source}{formattedDate ? ` · ${formattedDate}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors text-xl leading-none flex-shrink-0"
          >
            &times;
          </button>
        </div>

        <div className="p-5 flex-1 space-y-5">
          {article.summary && (
            <p className="text-sm text-text leading-relaxed">{article.summary}</p>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Read full article
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
