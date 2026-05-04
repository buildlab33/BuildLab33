import { cn } from "@/lib/utils";

interface BrandBadgeProps {
  brandId: string;
  brandName: string;
  className?: string;
}

export function BrandBadge({ brandName, className }: BrandBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white gradient-brand",
        className
      )}
    >
      {brandName}
    </span>
  );
}
