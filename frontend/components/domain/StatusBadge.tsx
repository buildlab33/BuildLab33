import { cn } from "@/lib/utils";

type Status = "draft" | "pending" | "approved" | "scheduled" | "published" | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-text-muted" },
  pending: { label: "Pending", className: "text-warning" },
  approved: { label: "Approved", className: "text-success" },
  scheduled: { label: "Scheduled", className: "text-primary" },
  published: { label: "Published", className: "text-success" },
  rejected: { label: "Rejected", className: "text-error" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("text-xs font-semibold flex items-center gap-1", config.className, className)}>
      <span>●</span>
      {config.label}
    </span>
  );
}
