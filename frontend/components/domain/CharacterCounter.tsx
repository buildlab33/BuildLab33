import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const isOver = current > max;
  const isWarning = !isOver && current > max * 0.92;

  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        isOver ? "text-error" : isWarning ? "text-warning" : "text-text-muted",
        className
      )}
    >
      {current} / {max}
    </span>
  );
}
