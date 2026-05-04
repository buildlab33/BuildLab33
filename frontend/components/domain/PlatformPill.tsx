import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X (Twitter)",
  youtube: "YouTube",
};

interface PlatformPillProps {
  platform: string;
  active: boolean;
  onToggle: (platform: string) => void;
  className?: string;
}

export function PlatformPill({ platform, active, onToggle, className }: PlatformPillProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(platform)}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150",
        active
          ? "bg-primary-muted border-primary/30 text-text-active"
          : "bg-surface border-border text-text-muted hover:border-elevated hover:text-text-secondary",
        className
      )}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </button>
  );
}
