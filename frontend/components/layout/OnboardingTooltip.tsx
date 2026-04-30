"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingTooltipProps {
  pageKey: string;
  title: string;
  description: string;
  className?: string;
}

export function OnboardingTooltip({ pageKey, title, description, className }: OnboardingTooltipProps) {
  const storageKey = `onboarding_dismissed_${pageKey}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-primary/30 bg-primary-muted p-4 mb-6",
        className
      )}
    >
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Dismiss tip"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-1.5 h-1.5 rounded-full gradient-brand mt-1.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-text-active mb-1">{title}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
